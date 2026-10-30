# Presupuesto Felo — AGENTS.md

## 1. Project purpose

Presupuesto Felo is a personal multi-user budgeting application built with Next.js and Firebase/Firestore.

The application manages:

- income;
- real pay cycles;
- fixed financial commitments;
- variable expenses;
- credit cards;
- credit-card purchases;
- credit-card payments;
- spending categories;
- bank/expense account balance;
- committed money;
- real available cash;
- user authorization;
- push-payment reminders.

The application contains real financial data and financial calculations. Preserve accounting consistency and existing historical data.

Do not make assumptions about financial behavior when the current code or business rules can answer the question.

---

# 2. Core stack

Current architecture includes:

- Next.js
- React
- TypeScript
- Firebase Authentication
- Firestore
- Firebase Admin SDK where server-side privileged access is required
- Firestore Security Rules
- Vitest
- Firebase Emulator Suite for rules testing
- Vercel deployment

Before introducing a new dependency, first determine whether the existing project already provides the required capability.

Do not upgrade framework or package versions unless explicitly requested.

Inspect `package.json` before assuming exact dependency versions.

---

# 3. Working style

## Act directly

For normal development tasks:

- inspect the relevant files;
- understand the existing implementation;
- make the required changes;
- run the appropriate tests;
- run the build;
- report exactly what changed.

Do not repeatedly ask for approval before normal code edits, builds, linting, tests, or other non-destructive development operations.

Ask before:

- deleting important data;
- performing destructive migrations;
- resetting Firestore;
- deleting collections;
- rewriting Git history;
- removing large features;
- changing business rules when requirements are genuinely ambiguous.

Do not stop after describing a fix when the task clearly asks for implementation.

---

# 4. Before modifying code

Always inspect the current version of the relevant files before editing them.

This repository has evolved significantly and older implementations may still exist in Git history, copied files, prompts, or documentation.

The working tree is the source of truth.

Do not:

- reconstruct current code from memory;
- assume an older implementation is still present;
- overwrite newer behavior because an older file looks simpler;
- blindly replace complete modules without checking their current responsibilities.

When multiple systems interact, trace the full data path first.

Example:

`Firestore -> useBudgetData -> domain calculation -> dashboard/controller -> UI`

For financial bugs, identify which layer owns the calculation before modifying the UI.

---

# 5. Implementation philosophy

Prefer:

- explicit types;
- small domain functions;
- deterministic calculations;
- backwards compatibility;
- derived values instead of duplicated stored values;
- financial values rounded consistently to cents;
- clear separation between real cash movement and credit-card debt;
- existing helpers and domain abstractions.

Avoid:

- magic numbers;
- hardcoded user balances;
- duplicated financial calculations;
- putting business logic directly in React presentation components;
- silent data migrations;
- changing unrelated code while fixing a focused issue.

If a value such as `$2,387.00` is expected, never hardcode it.

The underlying transactions and formulas must derive the result.

---

# 6. Important domain files

Important files currently include or may include:

- `src/lib/budget/types.ts`
- `src/lib/budget/constants.ts`
- `src/lib/budget/utils.ts`
- `src/lib/budget/expense-account.ts`
- `src/lib/budget/credit-card-payment-calendar.ts`
- `src/hooks/useBudgetData.ts`
- `src/hooks/useBudgetDashboard.ts`
- `src/hooks/useCreditCardSummaries.ts`
- `src/hooks/useExpenseAccount.ts`
- `src/hooks/useCreditCards.ts`
- `src/components/budget/ExpenseAccountCard.tsx`
- `src/components/budget/CreditCardsView.tsx`
- fixed-payment components/modals
- movement/expense modals
- `firestore.rules`

Exact names and paths should be verified against the working tree.

---

# 7. Money calculations

Money calculations must be rounded to cents.

Use the project's existing money-rounding helper when available.

Do not rely on floating-point equality for determining whether financial obligations are complete.

Preserve existing tolerance logic such as `TOLERANCIA_MONEDA` where applicable.

Negative financial results can be meaningful.

For example, `disponibleReal` may legitimately be negative to show a deficit.

Do not automatically clamp financial deficits to zero unless the domain rule specifically requires it.

---

# 8. Expense account model

The expense account represents actual money held in the operating bank account.

The account has:

- a real starting/recalibrated balance;
- a starting balance date;
- deposits;
- bank/debit expenses;
- completed fixed payments that actually leave the bank;
- real credit-card payments.

Credit-card purchases do NOT immediately reduce the bank account.

They become credit-card debt.

The bank account is reduced only when an actual payment leaves the bank.

---

# 9. Expense account recalibration

A historical reconciliation was intentionally abandoned.

A real bank balance was used as a new financial baseline.

Historical transactions before that recalibration are retained for reference but must not be replayed into the new account balance.

The account model includes fields similar to:

- `saldoInicial`
- `fechaSaldoInicial`
- `ingresosIncluidosEnSaldoInicial`
- `gastosIncluidosEnSaldoInicial`
- `pagosFijosIncluidosEnSaldoInicial`
- `pagosTarjetaIncluidosEnSaldoInicial`

When working on account calculations, preserve the recalibration boundary.

Do not reintroduce old transactions into the current bank balance.

---

# 10. Expense account — real available money

The intended conceptual calculation is:

`totalComprometido = reservasFijas + tarjetasReservadas - solapamiento`

and:

`disponibleReal = saldoActual - totalComprometido`

Where:

- `saldoActual` is actual bank cash;
- `reservasFijas` represents outstanding fixed obligations that must be funded;
- `tarjetasReservadas` represents credit-card payments currently requiring bank money;
- `solapamiento` removes double counting.

Never use current total credit-card debt blindly as immediate committed bank cash.

Only the amount that the credit-card payment logic says currently requires reservation should be included.

---

# 11. Fixed commitments

A `CompromisoFijo` includes information such as:

- amount;
- due day;
- budget quincena;
- payment priority;
- preferred payment method;
- optional credit-card ID;
- active state.

Important:

`quincenaPresupuestaria` must be respected.

Do not reserve all active commitments for the entire month simultaneously.

A previous bug caused Q1 and Q2 commitments to be reserved together.

The fixed-reservation calculation must filter by the relevant financial/budget quincena.

Current behavior intentionally keeps the FULL fixed commitment reserved until that commitment is completed.

Example:

Fixed commitment: `$145`

Registered partial payment: `$50`

The fixed reservation remains:

`$145`

not:

`$95`

This is intentional.

---

# 12. Fixed payments made by credit card

A fixed obligation can be paid using a credit card.

When that happens:

- the fixed payment must reference the corresponding `tarjetaId`;
- the card debt must increase;
- no bank expense should be generated at purchase time;
- the fixed commitment and card balance must not be double counted.

A completed fixed commitment paid entirely by card behaves as:

- fixed reservation = `$0`;
- card debt remains;
- overlap = `$0`.

For a partially paid fixed commitment:

Example:

- fixed commitment = `$145`
- `$50` charged to a card
- fixed reservation remains `$145`
- card payment obligation may also contain that `$50`

The overlap mechanism exists to prevent double counting.

Conceptually:

`$145 + $50 - $50 = $145`

Overlap must be computed per credit card, not globally.

---

# 13. Credit-card model

Credit-card balances are separate from bank cash.

Current cards may include cards such as:

- Apple
- Costco
- Walmart

Do not hardcode these names into business logic.

Cards are configurable entities.

Typical card information includes:

- starting balance;
- starting date;
- cutoff day;
- payment day;
- active state;
- payment strategy;
- optional payment target;
- optional credit limit.

Payment strategies include concepts such as:

- pay full balance;
- target payment;
- minimum payment.

Use the current type definitions as the source of truth.

---

# 14. Credit-card payment windows

The application has payment-window logic.

The intended strategy is generally to prepare payment approximately five days before the cutoff.

The card system distinguishes between:

- current balance;
- principal obligation;
- whether the principal cutoff obligation has been covered;
- purchases after principal coverage;
- additional balance before cutoff;
- whether payment action is currently required.

Do not replace this system with a simplistic:

`reserve entire credit-card balance`

calculation.

The account should use the card summary's bank-reservation value, currently represented by a concept such as:

`montoReservarCuenta`

Only the amount currently requiring bank funding belongs in `tarjetasReservadas`.

---

# 15. Current known card behavior

A card outside its payment window may have debt without immediately reducing `Disponible real`.

Example:

A card can have a `$557` balance while its cutoff is still sufficiently far away.

That full `$557` should not automatically become an immediate bank reservation simply because it exists.

When the card enters the payment window, the existing payment-calendar logic determines what requires action.

---

# 16. Credit-card pending transactions — current feature

Current active work:

## 2B.3 — Pending credit-card transactions

Goal:

Allow the user to register transactions that are still shown as pending by the card issuer.

A pending card transaction must be stored and visible, but it must NOT yet affect official card accounting totals.

Use a state similar to:

`EstadoTransaccionTarjeta = "pendiente" | "contabilizada"`

For non-credit-card expenses the card state should normally be `null`.

---

# 17. Pending transaction semantics

A credit-card transaction with:

`estadoTarjeta = "pendiente"`

must:

- remain stored in Firestore;
- appear in transaction history;
- display clearly as pending;
- contribute to a separate pending amount;
- contribute to an optional projected balance;
- remain editable/deletable as appropriate.

It must NOT affect:

- official card balance;
- official aggregate card balance;
- official posted purchases total;
- cutoff calculations;
- principal payment calculations;
- additional payment calculations;
- `Pagar ahora`;
- account `tarjetasReservadas`;
- account `Disponible real`.

When changed to:

`estadoTarjeta = "contabilizada"`

it begins participating normally in all card calculations.

---

# 18. Backwards compatibility for pending transactions

Historical expense documents do not contain `estadoTarjeta`.

Those historical credit-card transactions MUST be interpreted as:

`"contabilizada"`

This avoids changing all historical balances.

Do not require a Firestore migration merely to support this feature unless there is a separate reason to perform one.

The normalization layer should provide compatibility.

---

# 19. 2B.3 implementation sequence

Work incrementally.

## 2B.3A — Domain/persistence

Add:

`EstadoTransaccionTarjeta`

to the budget domain.

Extend:

- `GastoVariable`
- `NuevoGastoVariable`

Persist `estadoTarjeta` in `useBudgetData`.

Historical documents without the field must normalize to `"contabilizada"` when they represent credit-card transactions.

Non-card expenses should use `null`.

Update Firestore rules.

Do not change calculations yet during 2B.3A.

## 2B.3B — Calculations

Update `useCreditCardSummaries.ts`.

Separate:

- posted/contabilized purchases;
- pending purchases.

Pending purchases must be excluded from all official card timelines and balances.

Expose useful derived fields, for example:

- `comprasPendientes`
- `cantidadComprasPendientes`
- `saldoProyectado`

Use the existing naming style where possible.

## 2B.3C — UI

Add transaction state selection when recording a credit-card expense.

Suggested choices:

- Contabilizada
- Pendiente

Default:

`Contabilizada`

unless existing UX makes a different choice clearly preferable.

Display per-card information such as:

- Saldo actual
- Pendiente
- Saldo proyectado

Also show an aggregate pending amount in the credit-card summary.

Clearly differentiate pending money from official debt.

## 2B.3D — Confirmation action

Allow a pending transaction to be changed to contabilized without deleting and recreating it.

Use a direct Firestore update.

After confirmation, all dependent calculations should update automatically through existing real-time listeners.

---

# 20. Expense categories

Credit-card expense categories are configurable.

The application currently supports budget-linked categories such as:

- food/supermarket;
- gas;

and categories such as:

- Other

which may not consume a variable-budget category.

Do not assume every card purchase maps to `CategoriaVariable`.

`categoria` may legitimately be `null`.

The transaction may additionally contain fields such as:

- `categoriaTarjetaId`
- `categoriaTarjetaNombre`
- `comentario`

Preserve this design.

Do not revert it to a simple hardcoded category enum.

---

# 21. "Other" category

The configurable `Otro` category may require a comment.

It may create card debt without consuming the Food or Gas budget.

Preserve this behavior.

Do not automatically assign `Otro` purchases to Food or Gas.

---

# 22. Firestore rules

Any new persisted field must be reviewed against `firestore.rules`.

This project intentionally uses explicit schemas with constructs such as:

- `keys().hasOnly(...)`
- `keys().hasAll(...)`

When adding a persisted field:

1. update the TypeScript model;
2. update read normalization;
3. update write logic;
4. update Firestore validation;
5. update rules tests if applicable.

Never weaken security rules simply to make an application write succeed.

Do not use broad allow rules as a shortcut.

Card IDs and other user-scoped references must continue to belong to the same authenticated user's namespace.

---

# 23. Multi-user architecture

Budget data is user-scoped.

Use the existing helpers for user paths, such as:

- `getUserCollection(...)`
- `getUserDocument(...)`
- `getUserConfigDocument(...)`

Do not revert user-scoped collections back to global Firestore collections.

Authorization is enforced through authenticated/authorized users and user-specific data paths.

Preserve this architecture.

---

# 24. Access requests

The application includes an access-request flow.

A new user can request access.

An administrator can approve or deny the request.

Do not bypass this flow when modifying authentication or Firestore rules.

---

# 25. New-user behavior

New users should begin with clean financial values.

Do not copy another user's balances, flows, transactions, or card values.

Default financial state should be zero/empty unless configuration explicitly provides another default.

---

# 26. Carry-over behavior

The budget includes quincenal/cycle carry-over behavior.

Surplus from one budget period can move to the following period according to the existing budget logic.

Do not redesign carry-over while working on unrelated card/account features.

---

# 27. Payment reminders

The application includes credit-card reminder/push logic.

The intended reminder concept is approximately five days before cutoff/payment action according to the existing payment-calendar implementation.

When transaction state changes affect card balances, ensure pending transactions do not accidentally generate payment alerts.

Do not alter notification behavior unless required by the feature being implemented.

---

# 28. UI conventions

Preserve the existing visual system unless explicitly asked to redesign it.

Prefer extending current components rather than creating unrelated duplicate components.

Financial values should clearly distinguish:

- actual;
- pending;
- projected;
- reserved;
- paid;
- available.

Do not present projected values as official balances.

For pending card transactions, visual wording should be explicit.

Good:

`Pendiente $74.40`

`Saldo proyectado $112.45`

Avoid ambiguous labels such as:

`Total $112.45`

when part of that number is not yet posted.

---

# 29. React/Next.js practices

Follow the current project architecture.

Do not move business calculations into JSX merely because the UI needs a new value.

Use:

- domain helpers;
- hooks;
- memoized derived state where appropriate;
- existing components.

Avoid unnecessary state when a value can be derived.

Do not introduce server/client boundary changes without understanding the current component structure.

---

# 30. TypeScript practices

Avoid `any`.

Prefer:

- discriminated unions;
- explicit domain types;
- nullable types when null has domain meaning;
- exhaustive handling where practical.

Do not hide type errors with unsafe assertions.

If TypeScript exposes a mismatch, fix the underlying data model or transformation.

---

# 31. Legacy data

Firestore contains historical documents created under older versions of the application.

Normalization code is important.

When adding new fields:

- determine the correct fallback for historical documents;
- avoid breaking reads;
- avoid forcing unnecessary mass migrations;
- document the fallback behavior.

Example:

Missing `estadoTarjeta` on an old credit-card transaction means:

`contabilizada`

not:

`pendiente`.

---

# 32. Testing

After a focused implementation, run the narrowest relevant tests first.

Then run the full appropriate validation.

At minimum for significant TypeScript changes:

`npm run build`

When Firestore rules change, also run the project's Firestore rules tests/emulator tests where available.

After they pass, rules may be deployed with the existing Firebase workflow.

Do not claim success if a build or test failed.

Report the exact failing file and error.

---

# 33. Build failures

When a build fails:

1. stop adding unrelated features;
2. fix the current build error;
3. rerun the build;
4. only then continue.

Do not stack additional changes on top of a known TypeScript failure.

---

# 34. Regression protection

Before changing a financial formula, identify the expected invariants.

Examples:

A credit-card purchase:

- increases card debt when contabilized;
- does not directly reduce bank cash.

A real card payment:

- reduces card debt;
- reduces bank cash.

A pending card purchase:

- is visible;
- does not yet increase official card debt;
- does not alter the bank account.

A fixed commitment paid with card:

- must not reduce the bank at purchase time;
- must increase card debt when contabilized;
- must not be counted twice through both fixed reservation and card reservation.

---

# 35. Do not hardcode current personal values

Current balances and transaction amounts are runtime data.

Never encode values such as:

- current bank balance;
- current card balance;
- current available money;
- expected available money;

inside source code merely to make the UI match a screenshot.

Screenshots and current balances are diagnostic evidence, not configuration.

---

# 36. Current expense-account status

The previous bug that reserved every active fixed commitment in the month was identified.

Fixed reservations must respect the relevant budget quincena.

Do not revert that correction.

The card reservation should continue to come from the card payment-window calculation rather than the entire card balance.

---

# 37. Preserve diagnostics while stabilizing financial logic

The expense-account UI currently contains or may contain a useful committed-money breakdown:

- Reservas fijas
- Tarjetas reservadas
- Solapamiento
- Total comprometido

Keep this breakdown while financial logic is being stabilized unless explicitly asked to remove it.

It is useful for diagnosing discrepancies.

---

# 38. Git workflow after every completed change

After EVERY completed development change, feature, fix, or implementation step:

1. finish the implementation;
2. run the relevant tests;
3. run the required build or validation;
4. confirm that the change is complete;
5. inspect `git status`;
6. summarize what changed;
7. ask the user exactly once whether they want to upload the completed change to Git.

Use wording similar to:

`The change is complete and validated. Do you want me to commit and push it to Git?`

Do NOT commit or push before receiving an explicit yes from the user.

If the user answers yes:

- inspect the current diff;
- include only the files related to the completed work unless the user explicitly wants all current changes;
- create an appropriate commit message based on the completed task;
- run `git add`, `git commit`, and `git push` automatically;
- do not ask for separate approval for each Git command;
- report the resulting commit and push status.

Prefer a single chained command when appropriate:

`git add <files> && git commit -m "<message>" && git push`

If all current changes belong to the completed task and are safe to include, this may be:

`git add . && git commit -m "<message>" && git push`

However, do not blindly use `git add .` if unrelated changes exist.

Always inspect `git status` and preferably `git diff` first.

If the user answers no:

- do not commit;
- do not push;
- leave the working tree unchanged;
- continue with the next requested task when appropriate.

Do not repeatedly ask about Git while a task is still in progress.

Ask only after the change is fully implemented and validated.

If validation fails:

- do not offer to push yet;
- fix the failure first;
- rerun validation;
- only offer the Git upload after the change passes.

If `git push` fails because of authentication, remote configuration, conflicts, branch protection, or another Git issue:

- report the exact error;
- attempt safe non-destructive remediation when appropriate;
- never force-push unless explicitly requested.

Never:

- rewrite Git history without explicit instruction;
- force-push without explicit instruction;
- discard unrelated user changes;
- commit secrets or `.env` files;
- commit generated credentials or service-account files.

---

# 39. Commit message conventions

Commit messages should be concise and describe the completed behavior.

Prefer messages such as:

`feat: add pending credit card transaction state`

`feat: exclude pending card transactions from balances`

`fix: reserve fixed commitments by budget quincena`

`fix: avoid duplicate card and fixed-payment reservations`

`test: add pending card transaction coverage`

Do not use vague messages such as:

`changes`

`update`

`fix stuff`

When a completed step belongs to the numbered implementation plan, the commit may reflect that step.

Example:

`feat: complete 2B.3A pending card persistence`

---

# 40. Scope discipline

When fixing an issue, do not opportunistically refactor unrelated modules.

If you notice another issue:

- mention it separately;
- do not include it in the current patch unless it blocks the requested work.

This is especially important in financial-domain code because unrelated refactors make regressions difficult to diagnose.

---

# 41. Comments and documentation

Comments should explain domain reasoning, not restate obvious syntax.

Useful:

`Pending card transactions are excluded because the issuer has not posted them yet.`

Not useful:

`Increment total by amount.`

Preserve important historical/business-rule comments when modifying existing functions.

---

# 42. When requirements conflict with current code

Do not silently choose one.

First determine whether:

- the implementation is wrong;
- the business rule changed;
- historical compatibility explains the difference.

For clear bugs, fix them.

For genuine business-rule ambiguity with material financial impact, explain the conflict before changing behavior.

---

# 43. Plans for complex work

For multi-file features or significant financial refactors, create a short implementation plan before editing.

The plan should identify:

- affected files;
- data-model changes;
- calculation changes;
- migration/backwards-compatibility requirements;
- Firestore-rule changes;
- UI changes;
- tests.

Then implement the plan rather than stopping after planning.

For small isolated fixes, proceed directly.

---

# 44. Definition of done

A task is not finished merely because code was edited.

For relevant tasks, completion means:

- current code inspected;
- requested behavior implemented;
- TypeScript compiles;
- applicable tests pass;
- Firestore rules updated if persistence changed;
- backwards compatibility considered;
- no unrelated financial behavior was changed;
- results and remaining limitations are clearly reported.

After all applicable validation passes, the final step before moving on is:

**Ask the user whether they want the completed change committed and pushed to Git.**

Do not consider the Git upload itself mandatory for task completion.

The user decides whether the completed change should be uploaded.

---

# 45. Current priority

The current development priority is:

**2B.3 — Pending credit-card transactions**

Continue from the current working tree.

Do not rebuild older completed work.

The intended sequence is:

1. 2B.3A — types, normalization, persistence, Firestore rules;
2. 2B.3B — card calculations;
3. 2B.3C — UI;
4. 2B.3D — mark pending transaction as contabilized;
5. run regression tests for cards and Expense Account.

After EACH completed and validated step above, ask whether the user wants that step committed and pushed to Git before beginning the next one.

Do not skip backwards compatibility.

---

# 46. Final instruction

Treat this application as a financial system.

Prefer correctness, traceability, and predictable behavior over cleverness.

Inspect first.

Change the smallest correct layer.

Test the result.

Preserve existing business rules unless the task explicitly changes them.

After each completed and validated change, ask whether the user wants it committed and pushed to Git.