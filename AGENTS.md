<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project decisions
- App data is loaded in one react-query query (`useAppData` in src/lib/data.ts) with paginated reads; mutations invalidate it. Why: small synthetic dataset, keeps every page consistent.
- Risk/campaign/department metrics are computed from interactions in src/lib/analytics.ts, never stored. Why: numbers always match the database.
- Open demo: RLS policies allow anon CRUD on synthetic tables; audit_logs is insert-only. Why: user chose no-login portfolio demo.
- Training lesson content and scenario message templates live in src/lib/content.ts; DB stores module metadata and attempts.
