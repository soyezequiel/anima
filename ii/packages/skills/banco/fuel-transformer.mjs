/**
 * TRANSFORMER DE COMBUSTIBLE — prototipo del Hito 0.
 *
 * El documento de arquitectura descarta QuickJS-WASM y adopta, en su lugar,
 * ejecución síncrona en JS nativo con el combustible instrumentado por un
 * transformer de TypeScript sobre AST:
 *
 *   «El transformer inyecta __fuel() en cada back-edge de bucle y cada entrada
 *    de función. Al agotarse NO lanza: emite un yield cooperativo.
 *    Un plugin de esbuild NO sirve: esbuild no expone su AST a los plugins,
 *    opera sobre texto. ts.transform() sí da AST.»
 *
 * Y declara un criterio de corte: si cuesta más del 15% de overhead, el plan
 * del sandbox cambia ahí.
 *
 * Esto es el prototipo que permite medirlo. La versión de producción se escribe
 * en el Hito 4, con lo que se aprenda acá.
 *
 * POR QUÉ LOS DOS PUNTOS DE INYECCIÓN Y NO OTROS:
 *   - back-edge de bucle: un bucle es la única forma de gastar tiempo ilimitado
 *     sin crecer el stack. `while(true){}` tiene que morir.
 *   - entrada de función: la recursión es la otra forma, y no tiene back-edge.
 * Con esos dos, no hay programa que corra para siempre sin tocar el contador.
 * Instrumentar cada sentencia sería más preciso y mucho más caro, y la
 * precisión no hace falta: el presupuesto es un tope, no una factura.
 */

/**
 * @param {import('typescript')} ts
 * @param {{ nombreContador?: string }} [opciones]
 * @returns {import('typescript').TransformerFactory<import('typescript').SourceFile>}
 */
export function crearTransformerDeCombustible(ts, opciones = {}) {
  const NOMBRE = opciones.nombreContador ?? '__fuel'
  // 'llamada' inyecta `__fuel()`. 'inline' inyecta la comprobación desnuda,
  // sin llamada a función. La diferencia entre las dos es el hallazgo del
  // banco: en el camino caliente, la llamada cuesta más que el contador.
  const MODO = opciones.modo ?? 'llamada'
  // Si es false, NO se instrumentan las entradas de funcion: solo los bucles.
  // La recursion infinita queda cubierta por el RangeError del stack, que el
  // ejecutor tiene que atrapar igual. Es mas barato y menos limpio.
  const CON_FUNCIONES = opciones.conFunciones ?? true

  return (ctx) => {
    const f = ctx.factory
    const llamada = () =>
      MODO === 'inline'
        ? // if (--__fuelLeft < 0) __fuelOut();
          f.createIfStatement(
            f.createBinaryExpression(
              f.createPrefixUnaryExpression(
                ts.SyntaxKind.MinusMinusToken,
                f.createIdentifier('__fuelLeft'),
              ),
              ts.SyntaxKind.LessThanToken,
              f.createNumericLiteral(0),
            ),
            f.createExpressionStatement(
              f.createCallExpression(f.createIdentifier('__fuelOut'), undefined, []),
            ),
          )
        : f.createExpressionStatement(f.createCallExpression(f.createIdentifier(NOMBRE), undefined, []))

    /**
     * Mete la llamada al principio de un cuerpo. Si el cuerpo no es un bloque
     * —`while (x) paso()`, o una flecha con cuerpo de expresión— hay que
     * envolverlo primero, porque no hay dónde insertar una sentencia.
     */
    const conCombustibleAdelante = (cuerpo, esExpresionDeRetorno) => {
      if (cuerpo === undefined) return cuerpo
      if (ts.isBlock(cuerpo)) {
        return f.updateBlock(cuerpo, [llamada(), ...cuerpo.statements])
      }
      if (esExpresionDeRetorno) {
        // Flecha con cuerpo de expresión: `(x) => x + 1` pasa a
        // `(x) => { __fuel(); return x + 1 }`.
        return f.createBlock([llamada(), f.createReturnStatement(cuerpo)], true)
      }
      // Sentencia suelta como cuerpo de bucle.
      return f.createBlock([llamada(), cuerpo], true)
    }

    const visitar = (nodo) => {
      // ── Bucles: el back-edge ─────────────────────────────────────────────
      if (ts.isWhileStatement(nodo)) {
        const n = ts.visitEachChild(nodo, visitar, ctx)
        return f.updateWhileStatement(n, n.expression, conCombustibleAdelante(n.statement, false))
      }
      if (ts.isDoStatement(nodo)) {
        const n = ts.visitEachChild(nodo, visitar, ctx)
        return f.updateDoStatement(n, conCombustibleAdelante(n.statement, false), n.expression)
      }
      if (ts.isForStatement(nodo)) {
        const n = ts.visitEachChild(nodo, visitar, ctx)
        return f.updateForStatement(
          n,
          n.initializer,
          n.condition,
          n.incrementor,
          conCombustibleAdelante(n.statement, false),
        )
      }
      if (ts.isForOfStatement(nodo)) {
        const n = ts.visitEachChild(nodo, visitar, ctx)
        return f.updateForOfStatement(
          n,
          n.awaitModifier,
          n.initializer,
          n.expression,
          conCombustibleAdelante(n.statement, false),
        )
      }
      if (ts.isForInStatement(nodo)) {
        const n = ts.visitEachChild(nodo, visitar, ctx)
        return f.updateForInStatement(
          n,
          n.initializer,
          n.expression,
          conCombustibleAdelante(n.statement, false),
        )
      }

      // ── Funciones: la recursión ──────────────────────────────────────────
      if (CON_FUNCIONES && ts.isFunctionDeclaration(nodo) && nodo.body) {
        const n = ts.visitEachChild(nodo, visitar, ctx)
        return f.updateFunctionDeclaration(
          n,
          n.modifiers,
          n.asteriskToken,
          n.name,
          n.typeParameters,
          n.parameters,
          n.type,
          conCombustibleAdelante(n.body, false),
        )
      }
      if (CON_FUNCIONES && ts.isFunctionExpression(nodo)) {
        const n = ts.visitEachChild(nodo, visitar, ctx)
        return f.updateFunctionExpression(
          n,
          n.modifiers,
          n.asteriskToken,
          n.name,
          n.typeParameters,
          n.parameters,
          n.type,
          conCombustibleAdelante(n.body, false),
        )
      }
      if (CON_FUNCIONES && ts.isArrowFunction(nodo)) {
        const n = ts.visitEachChild(nodo, visitar, ctx)
        const esExpr = !ts.isBlock(n.body)
        return f.updateArrowFunction(
          n,
          n.modifiers,
          n.typeParameters,
          n.parameters,
          n.type,
          n.equalsGreaterThanToken,
          conCombustibleAdelante(n.body, esExpr),
        )
      }
      if (CON_FUNCIONES && ts.isMethodDeclaration(nodo) && nodo.body) {
        const n = ts.visitEachChild(nodo, visitar, ctx)
        return f.updateMethodDeclaration(
          n,
          n.modifiers,
          n.asteriskToken,
          n.name,
          n.questionToken,
          n.typeParameters,
          n.parameters,
          n.type,
          conCombustibleAdelante(n.body, false),
        )
      }

      return ts.visitEachChild(nodo, visitar, ctx)
    }

    return (sf) => ts.visitNode(sf, visitar)
  }
}

/** Cuenta cuántos puntos de inyección tendría un fuente, sin transformarlo. */
export function contarPuntosDeInyeccion(ts, codigo) {
  const sf = ts.createSourceFile('x.ts', codigo, ts.ScriptTarget.ES2022, true)
  let n = 0
  const ver = (nodo) => {
    if (
      ts.isWhileStatement(nodo) ||
      ts.isDoStatement(nodo) ||
      ts.isForStatement(nodo) ||
      ts.isForOfStatement(nodo) ||
      ts.isForInStatement(nodo) ||
      ts.isArrowFunction(nodo) ||
      ts.isFunctionExpression(nodo) ||
      (ts.isFunctionDeclaration(nodo) && nodo.body) ||
      (ts.isMethodDeclaration(nodo) && nodo.body)
    ) {
      n++
    }
    ts.forEachChild(nodo, ver)
  }
  ts.forEachChild(sf, ver)
  return n
}
