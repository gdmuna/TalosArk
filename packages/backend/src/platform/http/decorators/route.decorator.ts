import { applyDecorators, HttpCode, SetMetadata } from '@nestjs/common';
import { RESPONSE_PASSTHROUGH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum.js';
import { ApiConsumes, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import {
    AUTH_STRATEGY_KEY,
    ROUTE_CONTRACT_KEY,
    compileRouteContract,
    type ApiRouteOptions,
} from '../route/route.contract.js';
import { routeRequestDocumentation, routeResponseDocumentation } from '../route/route.openapi.js';

export { AUTH_STRATEGY_KEY } from '../route/route.contract.js';
export type {
    AUTH_STRATEGY_TYPE,
    ApiRouteOptions,
    ApiRouteRequest,
    ApiRouteResponse,
} from '../route/route.contract.js';

export function ApiRoute(options: ApiRouteOptions): MethodDecorator {
    const contract = compileRouteContract(options);
    const decorate = applyDecorators(
        SetMetadata(AUTH_STRATEGY_KEY, contract.auth),
        SetMetadata(ROUTE_CONTRACT_KEY, contract),
        ApiOperation({
            summary: options.summary,
            description: options.description,
            deprecated: options.deprecated,
        }),
        ...routeRequestDocumentation(contract.request),
        ...routeResponseDocumentation(contract),
        ...(contract.defaultStatus === undefined ? [] : [HttpCode(contract.defaultStatus)]),
        ...(contract.request.body
            ? [ApiConsumes(...(options.consumes ?? ['application/json']))]
            : []),
        ...(contract.auth === 'public' ? [] : [ApiSecurity({ accessToken: [] })]),
        ...(contract.auth !== 'required' ? [ApiSecurity({})] : [])
    );
    return (target, key, descriptor) => {
        const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, target.constructor, key) as
            Record<string, unknown> | undefined;
        const nativeResponse = Object.keys(args ?? {}).some((argument) =>
            argument.startsWith(`${RouteParamtypes.RESPONSE}:`)
        );
        if (
            nativeResponse &&
            !Reflect.getMetadata(RESPONSE_PASSTHROUGH_METADATA, target.constructor, key)
        ) {
            throw new Error(
                `ApiRoute ${String(key)} requires @Res({ passthrough: true }) and a returned payload`
            );
        }
        decorate(target, key, descriptor);
    };
}
