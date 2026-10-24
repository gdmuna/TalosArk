import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { FORBIDDEN_MESSAGE } from '@nestjs/core/guards/constants.js';
import { RequestError } from '../request/request.error.js';
import { WsInvocation } from './ws.contract.js';

/** Let the outer adapter own the one ACK, including failures from Nest guards and pipes. */
@Catch()
export class WsExceptionFilter implements ExceptionFilter {
    catch(error: unknown, host: ArgumentsHost): void {
        const invocation = host.switchToWs().getData<WsInvocation>();
        invocation.failure = {
            error:
                error instanceof WsException && error.getError() === FORBIDDEN_MESSAGE
                    ? new RequestError({ reason: 'forbidden' }, { cause: error })
                    : error,
        };
    }
}
