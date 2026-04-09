# Batching Protocol

This rule applies to every phase of every skill that issues multiple tool calls.

## The Rule

**Issue ALL independent tool calls in a single message.** Never issue searches,
fetches, or verifications one at a time — this forces the user to approve each
call individually and creates a terrible experience.

## When This Applies

- **WebSearch** — if a phase requires 3 searches, all 3 go in one message
- **WebFetch** — if verifying 5 URLs, all 5 go in one message
- **ATS API calls** — all verification calls in one parallel batch
- **Body fetches** — all email body reads in one message
- **Any other multi-target operation** — same principle

## How to Batch

If a phase has N independent calls, they go in **one message** with N tool calls,
not N messages with 1 tool call each.

```
[WebSearch: query1] [WebSearch: query2] [WebSearch: query3]
```

Not:
```
[WebSearch: query1]
... wait for approval ...
[WebSearch: query2]
... wait for approval ...
[WebSearch: query3]
```

## Exceptions

- Calls that depend on previous results (e.g., Phase 2 depends on Phase 1 output)
  must be sequential — but within each phase, batch everything.
- If a batch is very large (20+ calls), splitting into 2-3 sub-batches is acceptable
  to avoid timeouts.
