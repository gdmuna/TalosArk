import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import {
    REQUEST_ROUTE_CONTRACT,
    ROUTE_CONTRACT_KEY,
    type RouteContract,
} from './route.contract.js';

/** Capture before other guards: exception filters do not receive the route handler. */
@Injectable()
export class RouteContractGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        request[REQUEST_ROUTE_CONTRACT] = this.reflector.get<RouteContract>(
            ROUTE_CONTRACT_KEY,
            context.getHandler()
        );
        return true;
    }
}
