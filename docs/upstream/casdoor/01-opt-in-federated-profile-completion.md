# Draft: opt-in Casdoor profile completion after federated sign-in

**Status:** Draft only; not posted to Casdoor.
**Suggested destination:** Add this proposal to [#4204](https://github.com/casdoor/casdoor/issues/4204) or discuss it in [Casdoor Discussions](https://github.com/casdoor/casdoor/discussions) before opening a separate issue. #4204 already covers the missing-field use case.
**Suggested title if maintainers request a separate issue:** `[Feature] Make Casdoor profile completion after SSO opt-in`

---

## Summary

Please consider an **opt-in, per-application** way to collect missing **Casdoor-owned identity/profile fields** after a user authenticates with an external OAuth/OIDC or SAML provider. It should not become a generic mechanism for enforcing each downstream application's business-specific onboarding requirements.

## Motivation

An external provider may authenticate a user while omitting a field that the Casdoor application expects, such as a phone number. This is the scenario described in [#3779](https://github.com/casdoor/casdoor/issues/3779) and [#4204](https://github.com/casdoor/casdoor/issues/4204).

The two existing `Prompted` settings are easy to confuse: the `Prompted` option in the application's **Providers** table asks users to bind a provider, while a `Prompted` signup item refers to a profile field. The former does not collect the latter. The earlier implementation attempts, [#4307](https://github.com/casdoor/casdoor/pull/4307) and [#4985](https://github.com/casdoor/casdoor/pull/4985), are both closed without being merged. They also used different triggers: missing `required` fields versus fields marked both `required` and `prompted`.

At the same time, many completeness rules belong to the relying application rather than to Casdoor. For example, an application-specific organization profile should be completed after Casdoor authentication in that application, not added to Casdoor's global user record.

## Proposed solution

- Keep the current federated sign-in behavior when the new policy is disabled. The policy should be explicitly enabled per Casdoor application and should default to disabled.
- Scope the policy to fields represented and validated by Casdoor itself. Do not require Casdoor to understand arbitrary downstream business fields.
- When enabled, inspect only the configured fields after external authentication. If any are missing, offer an interaction to complete them before returning a successful authorization result to the relying application.
- Apply the field's existing validation and verification rules. A non-empty value is not equivalent to a verified email address or phone number.
- If the user cancels or the interaction expires, do not return a successful OIDC/OAuth authorization response or SAML assertion for that attempt.
- Keep the original authorization request intact while the interaction is pending. A Casdoor-hosted page may handle the browser flow; if API-driven interaction is supported, give it a separate, documented response contract rather than returning proprietary JSON as a standard authorization response.

## Acceptance criteria

- [ ] An application with the policy disabled continues to behave as it does today.
- [ ] An application with the policy enabled can specify which Casdoor-owned fields trigger completion after federated authentication.
- [ ] Missing fields are validated server-side, including any required verification, before the authorization flow succeeds.
- [ ] Cancelled, expired, and non-interactive authorization attempts cannot bypass the configured requirement.
- [ ] The behavior and configuration are documented without implying that downstream business onboarding is Casdoor's responsibility.

## Open questions for maintainers

1. Should the trigger reuse `required && prompted` from Signup Items, as proposed by [#4985](https://github.com/casdoor/casdoor/pull/4985), or be a separate explicit policy? Automatically applying `required` alone, as proposed by [#4307](https://github.com/casdoor/casdoor/pull/4307), may change existing deployments.
2. Should completion happen before a persistent Casdoor user is created, as requested in [#3779](https://github.com/casdoor/casdoor/issues/3779), or may a provisional user exist as long as no successful authorization result is issued, as discussed in [#4204](https://github.com/casdoor/casdoor/issues/4204)?
3. Should the first version cover only new federated users, or also existing Casdoor users whose profile is incomplete for this application?
4. Is a Casdoor-hosted page sufficient initially, or should the feature define a separate interaction API for clients that provide their own UI?

## Alternatives considered

- **Handle every missing field in the downstream application:** appropriate for business-specific data, but it cannot enforce a Casdoor-owned prerequisite before Casdoor creates or authorizes a user.
- **Automatically apply all required Signup Items to federated sign-in:** simpler configuration, but changes the current meaning of `required` and could unexpectedly block existing integrations.

## Related issues and references

- [#3779 — missing required fields during third-party registration](https://github.com/casdoor/casdoor/issues/3779)
- [#4204 — collect registration items after SSO and before redirect](https://github.com/casdoor/casdoor/issues/4204)
- [#4307 — first, unmerged implementation attempt](https://github.com/casdoor/casdoor/pull/4307)
- [#4985 — second, unmerged implementation attempt](https://github.com/casdoor/casdoor/pull/4985)
- [Casdoor Signup Items documentation](https://casdoor.ai/docs/application/signup-items-table/)
- [Casdoor application terminology](https://casdoor.ai/docs/application/terminology/)
