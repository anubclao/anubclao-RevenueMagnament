# Feature: [Nombre del Feature]

## 1. User Story
**As a** [user role],
**I want to** [action],
**So that** [benefit/value].

---

## 2. Acceptance Criteria
- [ ] Criterion 1: [Exact behavior expected]
- [ ] Criterion 2: [Exact behavior expected]
- [ ] Criterion 3: [Exact behavior expected]

---

## 3. Edge Cases

### Error States
- What happens if the API fails? → [Expected behavior]
- What happens on network timeout? → [Expected behavior]

### Empty States
- What happens with no data? → [Expected UI]

### Loading States
- What happens during API call? → [Expected UI]

---

## 4. Technical Contract

### Component Props
```typescript
interface [ComponentName]Props {
  prop1: string;
  prop2: (data: DataType) => void;
}
```

### API Contract
```typescript
interface [Feature]Request { }
interface [Feature]Response { }
```

---

## 5. Dependencies
### Files to Create
- `/src/components/[ComponentName].tsx`
- `/tests/verifiers/[feature].spec.ts`

### Files to Modify
- `/src/services/ai.ts`

---

## 6. Out of Scope
- [What this feature will NOT include]

---

## 7. Approval
**Status:** ⏳ Pending Review
