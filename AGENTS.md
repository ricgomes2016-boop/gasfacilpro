# Architecture rules
- Preserve App.tsx, provider nesting and existing route definitions; adapt stock-conference access at its existing ProtectedRoute boundary to keep ERP navigation stable.
- Yard conference accounts use a separate native-auth client storage key and a scoped Edge Function; never attach their sessions to the ERP client or grant general tenant membership.
- Store yard-account roles and unit authorization in protected dedicated tables; every conference API operation validates the user and authorized units server-side.
- Store new conference counts by sales day with physical count date and opening/closing moment separately; read legacy counts as opening counts without rewriting them, so historical stock is preserved.
- Send yard entry and transfer writes through the scoped conference function, validating origin authorization and same-company active destinations; never grant ERP access for movements.