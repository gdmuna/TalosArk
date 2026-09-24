# Draft: verify account ownership before linking an external identity

**Status:** Draft only; not posted to Casdoor.
**Security handling:** If investigation confirms that an attribute match can be used to access another user's Casdoor account, follow [Casdoor's private security reporting policy](https://github.com/casdoor/casdoor/blob/master/SECURITY.md) and contact `admin@casdoor.org` before publishing an issue. Do not put reproduction details or an exploit path in a public issue. The proposal below is a public-safe feature discussion for use **after** that triage.
**Suggested title:** `[Feature] Verify account ownership before linking an external identity`

---

## Summary

When a newly authenticated external identity matches an existing Casdoor user by an attribute such as email, phone, or username, treat that user as a **candidate account**, not as an already verified account binding. Provide an interaction in which the user proves control of the existing Casdoor account before the new external identity is linked to it.

## Motivation

Casdoor's documented provider Binding Rule checks `Email`, `Phone`, and `Name` in order and links the first matching user. Matching an attribute is useful for finding a candidate account, but it is a different operation from proving that the person authenticating through a new provider controls that existing account. These two operations should have distinct states and outcomes.

This request concerns **Casdoor account ownership and external-identity linking**, not the completeness of a downstream application's business profile.

## Proposed solution

- Keep ordinary sign-in unchanged when the external provider identity is **already linked** to a Casdoor account.
- When an external identity is new and an attribute match finds an existing Casdoor account, pause the linking step. Ask the user to authenticate with a pre-existing method for that Casdoor account, or use an already established, sufficiently recent Casdoor session, before confirming the new link.
- If there is no candidate account, use the application's existing sign-up policy. If the match is ambiguous or the user cannot prove ownership, do not link automatically; offer an appropriate recovery or support path.
- Do not treat possession of an attribute in the newly received external profile as the proof of ownership of the existing Casdoor account.
- After successful proof, create the external-identity link once, ensure it does not conflict with another account, and resume the original authorization transaction. If proof is cancelled or expires, do not create the link or issue a successful authorization result for that account.
- Use the same server-side rule for Casdoor-hosted UI and any API-driven sign-in path. A proprietary interaction API may expose a pending next action, but standard OAuth/OIDC or SAML endpoints should emit their normal success or error responses only when the interaction reaches a terminal state.

## Acceptance criteria

- [ ] A previously linked external identity signs in without repeating account-ownership proof on every login.
- [ ] A new external identity that only matches an existing account by attributes is not linked until control of that account has been demonstrated.
- [ ] No match, multiple matches, failed proof, cancellation, expiry, and concurrent linking attempts have defined, safe outcomes.
- [ ] A pending proof cannot be bypassed through another login API or by requesting an OAuth/OIDC code, token, or SAML assertion through another path.
- [ ] Existing links remain usable; any change to existing automatic binding behavior has a documented migration and compatibility policy.

## Questions for maintainers

1. Which existing Casdoor authentication methods should count as sufficient proof for a new link? Should an existing session require recent reauthentication?
2. Should attribute-based Binding Rules continue to find candidate accounts, with proof required before linking, or should administrators explicitly select a trusted automatic-linking policy for some providers?
3. How should a pending interaction be resumed for applications that use Casdoor APIs or SDKs instead of Casdoor's hosted login UI?
4. Would maintainers prefer to handle the security review privately first and then discuss the public feature and migration design in a GitHub issue?

## Alternatives considered

- **Automatically link on the first attribute match:** preserves current behavior but conflates account discovery with ownership proof.
- **Always create a separate Casdoor account:** avoids automatic linking but can create duplicates and leaves legitimate users without a safe path to connect their identities.
- **Have every downstream application perform linking:** duplicates IAM account-linking rules and cannot protect Casdoor's own user directory consistently.

## Related references

- [Casdoor application terminology: provider Binding Rules](https://casdoor.ai/docs/application/terminology/)
- [#2873 — an earlier request concerning matching OAuth users by email](https://github.com/casdoor/casdoor/issues/2873)
- [NIST SP 800-63C account linking guidance](https://pages.nist.gov/800-63-4/sp800-63c/Federation/#account-linking)
- [Casdoor security reporting policy](https://github.com/casdoor/casdoor/blob/master/SECURITY.md)
