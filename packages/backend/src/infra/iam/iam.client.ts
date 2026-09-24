import { type CasdoorClient } from './casdoor.client.js';
import { IamOidcAdapter } from './iam-oidc.adapter.js';
import { IamTokenAdapter } from './iam-token.adapter.js';
import { CASDOOR_SDK } from './iam.constants.js';

import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class IamClient {
    constructor(
        @Inject(CASDOOR_SDK) readonly casdoorClient: CasdoorClient,
        readonly iamOidcAdapter: IamOidcAdapter,
        readonly iamTokenAdapter: IamTokenAdapter
    ) {}
}
