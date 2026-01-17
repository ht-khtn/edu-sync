/**
 * STRICT DEFENSIVE PROGRAMMING IMPLEMENTATION
 * Based on provided SPEC without modification to logic or ordering.
 */

// --- 1. GENERIC INTERFACES ---

export interface IRealtimeEvent {
    id: string;               // Unique Event ID
    intent: 'MUTATION' | 'SIDE_EFFECT' | 'INFO'; // Explicit Intent Metadata
    target_entity_id: string | null;           // Scoped Entity ID
    occurred_at: number;      // Unix Timestamp (ms)
    version?: number;         // Monotonic version (optional high-water mark source)
    payload: Record<string, unknown>;
}

export interface IGuardState {
    activeEntityId: string | null;          // Context Awareness
    lastProcessedTimestamp: number;         // High-Water Mark barrier
    processedEventIds: Set<string>;         // Idempotency / Duplicate Guard
}

// Initial state factory (helper)
export function createInitialGuardState(): IGuardState {
    return {
        activeEntityId: null,
        lastProcessedTimestamp: 0,
        processedEventIds: new Set<string>()
    };
}

// --- 2. CORE LOGIC ---

/**
 * FIX #2: Event Filtering Guard (Context Awareness Layer)
 * Must be called FIRST.
 */
export function shouldProcessEvent(event: IRealtimeEvent, state: IGuardState): boolean {
    // 1. Structural Validation (Defensive Check)
    if (!event || !event.id || typeof event.occurred_at !== 'number') {
        return false; // Malformed event structure
    }

    // 2. Intent Filtering (Noise Reduction)
    // Only allow mutations to trigger state transitions
    if (event.intent !== 'MUTATION') {
        return false;
    }

    // 3. Context/Scope Filtering (Target validation)
    // Prevent cross-entity event pollution
    // If we are viewing Entity A, ignore events for Entity B
    if (state.activeEntityId && event.target_entity_id !== state.activeEntityId) {
        return false;
    }

    return true;
}

/**
 * FIX #3: Idempotent Guard (High-Water Mark + Deduplication)
 * Must be called SECOND.
 */
export function isIdempotent(event: IRealtimeEvent, state: IGuardState): boolean {
    // Check 1: Time/Version ordering (High-Water Mark)
    // Rejects stale events caused by network races
    if (event.occurred_at <= state.lastProcessedTimestamp) {
        // Warning: Stale event detected
        // console.warn(`[Guard] Skipped stale event: ${event.id}`);
        return false;
    }

    // Check 2: Duplicate Message Guard (Exact ID Match)
    // Rejects retries or double-sends from transport layer
    if (state.processedEventIds.has(event.id)) {
        // Warning: Duplicate event detected
        // console.warn(`[Guard] Skipped duplicate event: ${event.id}`);
        return false;
    }

    return true;
}

/**
 * MAIN HANDLER
 * Strictly enforces the processing order: Filter -> Guard -> Commit -> Execute
 */
export function handleRealtimeEvent(
    event: IRealtimeEvent, 
    state: IGuardState,
    implementationApplyFn: (payload: Record<string, unknown>) => void
) {
    // BƯỚC 1: Early Return (Fix #2 - Context Awareness)
    if (!shouldProcessEvent(event, state)) {
        return;
    }

    // BƯỚC 2: Idempotent Guard (Fix #3 - Ordering & Uniqueness)
    // Critical Section begins
    if (!isIdempotent(event, state)) {
        return;
    }

    // BƯỚC 3: Update Guard State (Commit Phase)
    // Update Barrier IMMEDIATELY to block subsequent stale/concurrent events
    state.lastProcessedTimestamp = event.occurred_at;
    
    // Add to duplicate guard (Maintenance/Cleanup logic excluded per strict spec scope)
    state.processedEventIds.add(event.id);

    // BƯỚC 4: Execute State Transition (Application Phase)
    // Only now is it safe to touch the domain logic
    implementationApplyFn(event.payload);
}
