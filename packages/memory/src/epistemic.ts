/**
 * Vocabulario epistemologico comun. Estos datos son deliberadamente simples,
 * serializables y ajenos al LLM: cualquier subsistema puede producirlos y
 * consumirlos sin interpretar prosa para decidir si algo es un hecho.
 */

export type KnowledgeStatus =
  'observed' | 'learned' | 'inferred' | 'hypothetical' | 'refuted' | 'unknown';

export type KnowledgeSourceKind =
  'perception' | 'world' | 'experience' | 'caretaker' | 'model' | 'legacy' | 'system';

export interface KnowledgeSource {
  kind: KnowledgeSourceKind;
  /** Id de evento, mensaje, prueba o componente que permite auditar el origen. */
  ref?: string;
  description: string;
}

export type KnowledgeScope =
  { kind: 'entity'; entityId: string } | { kind: 'type'; typeId: string } | { kind: 'general' };

export interface KnowledgeEvidence {
  id: string;
  supports: boolean;
  description: string;
  source: KnowledgeSource;
  atTick: number;
  at?: number;
}

export interface KnowledgeRevision {
  atTick: number;
  at?: number;
  previousContent: string;
  previousStatus: KnowledgeStatus;
  previousConfidence: number;
  reason: string;
}

export type UncertaintyActionKind = 'ask' | 'observe' | 'experiment';

export interface UncertaintyAction {
  kind: UncertaintyActionKind;
  description: string;
}

export interface KnowledgeRecord {
  id: string;
  /** Clave estable opcional: permite actualizar "posicion" aunque cambie su contenido. */
  topic?: string;
  content: string;
  status: KnowledgeStatus;
  source: KnowledgeSource;
  evidence: KnowledgeEvidence[];
  confidence: number;
  acquiredAtTick: number;
  acquiredAt?: number;
  expiresAtTick?: number;
  expiresAt?: number;
  scope: KnowledgeScope;
  revisions: KnowledgeRevision[];
  /** Dato concreto cuya ausencia impide responder o actuar. */
  missingData?: string[];
  resolutionOptions?: UncertaintyAction[];
}

export interface KnowledgeInput {
  topic?: string;
  content: string;
  status: KnowledgeStatus;
  source: KnowledgeSource;
  evidence?: Omit<KnowledgeEvidence, 'id'>[];
  confidence: number;
  acquiredAtTick: number;
  acquiredAt?: number;
  expiresAtTick?: number;
  expiresAt?: number;
  scope?: KnowledgeScope;
  missingData?: string[];
  resolutionOptions?: UncertaintyAction[];
}

export interface KnowledgeQuery {
  topic?: string;
  content?: string;
  scope?: KnowledgeScope;
  atTick?: number;
  at?: number;
}

export type KnowledgeVerdict = 'supported' | 'refuted' | 'hypothetical' | 'unknown' | 'stale';

export interface KnowledgeAssessment {
  verdict: KnowledgeVerdict;
  record?: KnowledgeRecord;
  missingData: string[];
  resolutionOptions: UncertaintyAction[];
  explanation: string;
}

export interface UnknownKnowledgeInput {
  topic?: string;
  content: string;
  atTick: number;
  at?: number;
  scope?: KnowledgeScope;
  reason?: string;
  missingData: string[];
  resolutionOptions?: UncertaintyAction[];
}

export function knowledgeScopeKey(scope: KnowledgeScope): string {
  if (scope.kind === 'entity') return `entity:${scope.entityId}`;
  if (scope.kind === 'type') return `type:${scope.typeId}`;
  return 'general';
}

export function sameKnowledgeScope(a: KnowledgeScope, b: KnowledgeScope): boolean {
  return knowledgeScopeKey(a) === knowledgeScopeKey(b);
}

export function normalizeKnowledgeContent(content: string): string {
  return content.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

export function isKnowledgeStale(record: KnowledgeRecord, atTick?: number, at?: number): boolean {
  return (
    (atTick !== undefined && record.expiresAtTick !== undefined && atTick > record.expiresAtTick) ||
    (at !== undefined && record.expiresAt !== undefined && at > record.expiresAt)
  );
}

export function defaultResolutionOptions(content: string): UncertaintyAction[] {
  return [
    { kind: 'ask', description: `preguntar por evidencia sobre: ${content}` },
    { kind: 'observe', description: `observar el mundo para comprobar: ${content}` },
    { kind: 'experiment', description: `hacer una prueba segura sobre: ${content}` },
  ];
}
