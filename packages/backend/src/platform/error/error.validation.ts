import { z } from 'zod';

export interface ValidationDiagnosticIssue {
    readonly field: string;
    readonly code: string;
    readonly expected: string;
    readonly received: string;
    readonly hint?: string;
}

export interface ValidationDiagnosticField {
    label?: string;
    scalar?: boolean;
    expected?: string;
    customExpected?: string;
    hint?: string;
}

export interface ValidationDiagnosticOptions {
    fields?: Readonly<Record<string, ValidationDiagnosticField>>;
    /** Only flat, application-owned environment schemas may enable this. */
    environment?: boolean;
    /** Exact messages declared by the owner, never arbitrary refinement messages. */
    refinements?: Readonly<Record<string, string>>;
}

const MAX_ISSUES = 20;
const bounded = (value: string, limit = 320) =>
    // eslint-disable-next-line no-control-regex -- Diagnostic text must not inject terminal control bytes.
    value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').slice(0, limit);

function valueAt(input: unknown, path: readonly PropertyKey[]): unknown {
    let current = input;
    for (const key of path) {
        if (!current || typeof current !== 'object') return undefined;
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor || !('value' in descriptor)) return undefined;
        current = descriptor.value;
    }
    return current;
}

function received(value: unknown, scalar: boolean, sensitive = false): string {
    if (value === undefined) return 'undefined (missing)';
    if (value === null) return 'null';
    if (!sensitive && scalar && (typeof value === 'number' || typeof value === 'boolean'))
        return String(value);
    if (typeof value === 'string') {
        if (sensitive) return value ? 'string (value redacted)' : 'string (empty)';
        if (
            scalar &&
            value.length <= 40 &&
            /^(?:true|false|Infinity|[+-]?\d+(?:\.\d+)?)$/.test(value)
        )
            return `string ${JSON.stringify(value)}`;
        return `string (length=${value.length}; value redacted)`;
    }
    if (Array.isArray(value)) return `array (length=${value.length}; values redacted)`;
    return `${typeof value} (value redacted)`;
}

function expected(issue: z.core.$ZodIssue, field: ValidationDiagnosticField): string {
    if (issue.code === 'custom') return field.customExpected ?? 'the declared field constraint';
    if (field.expected) return field.expected;
    if (issue.code === 'invalid_type') return issue.expected === 'int' ? 'integer' : issue.expected;
    if (issue.code === 'too_small' || issue.code === 'too_big') {
        const minimum = issue.code === 'too_small';
        const bound = minimum ? issue.minimum : issue.maximum;
        const comparator = minimum ? (issue.inclusive ? '>=' : '>') : issue.inclusive ? '<=' : '<';
        const quantity = ['string', 'array', 'set'].includes(issue.origin) ? ' length' : '';
        return `${issue.origin}${quantity} ${comparator} ${String(bound)}`;
    }
    if (issue.code === 'invalid_value')
        return `one of ${issue.values
            .slice(0, 10)
            .map((value) => (typeof value === 'string' ? JSON.stringify(value) : String(value)))
            .join(', ')}`;
    if (issue.code === 'invalid_format') return `a valid ${issue.format}`;
    if (issue.code === 'unrecognized_keys') return 'only declared fields';
    if (issue.code === 'invalid_union') return 'one of the declared alternatives';
    return 'a valid field value';
}

/** Project constraints and approved scalar values, without retaining the Zod error or input. */
export function validationDiagnostics(
    error: z.ZodError,
    input: unknown,
    options: ValidationDiagnosticOptions = {}
): readonly ValidationDiagnosticIssue[] {
    const issues = error.issues.slice(0, MAX_ISSUES).map((issue): ValidationDiagnosticIssue => {
        const key = typeof issue.path[0] === 'string' ? issue.path[0] : '';
        const configured = options.fields && Object.hasOwn(options.fields, key);
        const environment = options.environment && /^[A-Z][A-Z0-9_]{0,79}$/.test(key);
        const field = configured && options.fields ? options.fields[key] : {};
        const label = field.label ?? (configured || environment ? key : 'options');
        const indexes = issue.path
            .slice(1)
            .filter((part) => typeof part === 'number')
            .slice(0, 3);
        const sensitive = /(?:PASS|SECRET|TOKEN|KEY|CERTIFICATE|SMTP_USER|CLIENT_ID)/i.test(key);
        const scalar =
            !sensitive &&
            (field.scalar ??
                (!!environment &&
                    /(?:_PORT|^PORT$|_MS|_SECONDS|_LIMIT|_CONCURRENCY|_SECURE|_ENABLED|_REQUIRE_TLS|_PATH_STYLE)$/.test(
                        key
                    )));
        const value =
            issue.code !== 'custom' && 'input' in issue ? issue.input : valueAt(input, issue.path);
        const refinement =
            issue.code === 'custom' &&
            options.refinements &&
            Object.hasOwn(options.refinements, issue.message)
                ? options.refinements[issue.message]
                : undefined;
        return Object.freeze({
            field: bounded(`${label}${indexes.map((index) => `[${index}]`).join('')}`, 120),
            code: issue.code,
            expected: bounded(refinement ?? expected(issue, field)),
            received: bounded(received(value, !!scalar, sensitive), 120),
            ...(field.hint ? { hint: bounded(field.hint) } : {}),
        });
    });
    if (error.issues.length > MAX_ISSUES)
        issues.push(
            Object.freeze({
                field: 'configuration',
                code: 'issues_omitted',
                expected: 'correct the listed fields, then validate again',
                received: `${error.issues.length - MAX_ISSUES} additional issues omitted`,
            })
        );
    return Object.freeze(issues);
}

export function formatValidationIssues(issues: readonly ValidationDiagnosticIssue[]): string {
    return issues
        .map(
            (issue) =>
                `  - ${issue.field} [${issue.code}]\n` +
                `    expected: ${issue.expected}\n` +
                `    received: ${issue.received}` +
                (issue.hint ? `\n    hint: ${issue.hint}` : '')
        )
        .join('\n');
}

/** For owner-defined cross-field or SDK configuration checks, without fabricating a Zod error. */
export function configurationIssue(
    field: string,
    expectedValue: string,
    value: unknown,
    options: { scalar?: boolean; hint?: string } = {}
): ValidationDiagnosticIssue {
    return Object.freeze({
        field: bounded(field, 120),
        code: 'custom',
        expected: bounded(expectedValue),
        received: bounded(
            received(
                value,
                !!options.scalar,
                /(?:PASS|SECRET|TOKEN|KEY|CERTIFICATE|SMTP_USER|CLIENT_ID)/i.test(field)
            ),
            120
        ),
        ...(options.hint ? { hint: bounded(options.hint) } : {}),
    });
}

export class ConfigurationError extends Error {
    declare readonly summary: string;
    declare readonly validationIssues: readonly ValidationDiagnosticIssue[];

    constructor(name: string, issues: readonly ValidationDiagnosticIssue[]) {
        const summary = `Invalid ${bounded(name, 100)} configuration`;
        super(`${summary}\n${formatValidationIssues(issues)}`);
        this.name = 'ConfigurationError';
        Object.defineProperties(this, {
            summary: { value: summary },
            validationIssues: {
                value: Object.freeze(issues.map((issue) => Object.freeze({ ...issue }))),
            },
        });
    }
}

export function parseConfiguration<S extends z.ZodType>(
    schema: S,
    input: unknown,
    name: string,
    options: ValidationDiagnosticOptions = {}
): z.output<S> {
    const result = schema.safeParse(input, { reportInput: true });
    if (!result.success)
        throw new ConfigurationError(name, validationDiagnostics(result.error, input, options));
    return result.data;
}
