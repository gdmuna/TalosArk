/**
 * P1 Schema Migration Integration Tests
 *
 * 验证新增模型可以正常创建与查询。
 * 需要真实数据库连接（使用 .env.test 环境）。
 */
import { PrismaClient } from '../../prisma/generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

let prisma: PrismaClient;

beforeAll(async () => {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    prisma = new PrismaClient({ adapter });
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('P1 Schema Migration — New Models', () => {
    let testOrgId: string;
    let testUserId: string;
    let testNodeId: string;
    let loginTransactionId = '';
    let externalIdentityId = '';
    let sessionId = '';

    beforeAll(async () => {
        // 获取或创建测试用户
        let user = await prisma.user.findFirst();
        if (!user) {
            user = await prisma.user.create({
                data: {
                    username: 'test-migration-user',
                    email: 'test-migration@example.com',
                    passwordHash: 'hash',
                },
            });
        }
        testUserId = user.id;

        // 创建测试组织
        const org = await prisma.organization.create({
            data: {
                name: 'Test Migration Org',
                ownerId: testUserId,
            },
        });
        testOrgId = org.id;
    });

    it('Organization should have isPublic field', async () => {
        const org = await prisma.organization.findFirst({
            where: { id: testOrgId },
        });
        expect(org).toHaveProperty('isPublic');
        expect(typeof org!.isPublic).toBe('boolean');
    });

    it('Organization should have avatarUrl and settings fields', async () => {
        const org = await prisma.organization.findFirst({
            where: { id: testOrgId },
        });
        expect(org).toHaveProperty('avatarUrl');
        expect(org).toHaveProperty('settings');
    });

    it('should create a Node with type CONTAINER', async () => {
        const node = await prisma.node.create({
            data: {
                orgId: testOrgId,
                name: 'Test Container',
                type: 'CONTAINER',
            },
        });
        expect(node.id).toBeDefined();
        expect(node.type).toBe('CONTAINER');
        testNodeId = node.id;
    });

    it('should create NodeGridConfig for a Node', async () => {
        const config = await prisma.nodeGridConfig.create({
            data: { nodeId: testNodeId, rows: 9, cols: 9 },
        });
        expect(config.nodeId).toBe(testNodeId);
        expect(config.rows).toBe(9);
    });

    it('should create NodeImage for a Node', async () => {
        const image = await prisma.nodeImage.create({
            data: { nodeId: testNodeId, imageUrl: 'https://example.com/test.png' },
        });
        expect(image.nodeId).toBe(testNodeId);
    });

    it('should create a ReagentType for an org', async () => {
        const rt = await prisma.reagentType.create({
            data: {
                orgId: testOrgId,
                name: 'Test Reagent Type',
                reagentId: [],
                colorHex: '#2a9d99',
                unit: 'mL',
            },
        });
        expect(rt.id).toBeDefined();
        expect(rt.name).toBe('Test Reagent Type');
    });

    it('should create a ResourceShare record', async () => {
        // 创建第二个组织用于测试共享
        const org2 = await prisma.organization.create({
            data: {
                name: 'Test Migration Org 2',
                ownerId: testUserId,
            },
        });

        const share = await prisma.resourceShare.create({
            data: {
                resourceType: 'NODE',
                resourceId: testNodeId,
                ownerOrgId: testOrgId,
                granteeOrgId: org2.id,
                permission: 'READ',
                status: 'PENDING',
            },
        });
        expect(share.id).toBeDefined();
        expect(share.status).toBe('PENDING');

        // 清理第二个组织
        await prisma.resourceShare.deleteMany({ where: { granteeOrgId: org2.id } });
        await prisma.organization.delete({ where: { id: org2.id } });
    });

    it('Reagent should have nodeId field', async () => {
        const reagent = await prisma.reagent.findFirst();
        if (!reagent) return; // 跳过（测试环境无试剂）
        expect(reagent).toHaveProperty('nodeId');
    });

    it('should persist OIDC login transactions, external identities and sessions', async () => {
        const suffix = Date.now().toString();
        const transaction = await prisma.loginTransaction.create({
            data: {
                stateHash: `state-${suffix}`,
                nonce: `nonce-${suffix}`,
                pkceVerifier: `verifier-${suffix}`,
                expiresAt: new Date(Date.now() + 60_000),
            },
        });
        loginTransactionId = transaction.id;

        const externalIdentity = await prisma.externalIdentity.create({
            data: {
                issuer: 'https://casdoor.example.test',
                subject: `subject-${suffix}`,
                userId: testUserId,
            },
        });
        externalIdentityId = externalIdentity.id;

        const session = await prisma.session.create({
            data: {
                userId: testUserId,
                refreshTokenJti: `jti-${suffix}`,
                expiresAt: new Date(Date.now() + 60_000),
            },
        });
        sessionId = session.id;

        expect(transaction.consumedAt).toBeNull();
        expect(externalIdentity.userId).toBe(testUserId);
        expect(session.revokedAt).toBeNull();
    });

    afterAll(async () => {
        // 清理测试数据（逆序）
        await prisma.session.deleteMany({ where: { id: sessionId } });
        await prisma.externalIdentity.deleteMany({ where: { id: externalIdentityId } });
        await prisma.loginTransaction.deleteMany({ where: { id: loginTransactionId } });
        await prisma.resourceShare.deleteMany({ where: { resourceId: testNodeId } });
        await prisma.reagentType.deleteMany({
            where: { orgId: testOrgId, name: 'Test Reagent Type' },
        });
        await prisma.nodeImage.deleteMany({ where: { nodeId: testNodeId } });
        await prisma.nodeGridConfig.deleteMany({ where: { nodeId: testNodeId } });
        await prisma.node.delete({ where: { id: testNodeId } }).catch(() => {});
        await prisma.organization.delete({ where: { id: testOrgId } }).catch(() => {});
    });
});
