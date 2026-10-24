#!/usr/bin/env node

/**
 * Create Release Tag
 *
 * 用于自动发布工作流：
 * 1. 验证 package.json 版本
 * 2. 计算 tag 名称
 * 3. 创建 tag（不推送，由工作流推送）
 */

const { validatePackageVersion, setGitHubOutput, exec } = require('./version-utils.cjs');

function main() {
    const releaseBranch = process.argv[2];

    if (!releaseBranch) {
        console.error('❌ Error: Release branch name is required');
        console.error(
            'Usage: node packages/backend/tooling/release/create-release-tag.cjs <release-branch-name>'
        );
        process.exit(1);
    }

    console.log('==========================================');
    console.log(`📦 Release Branch: ${releaseBranch}`);
    console.log('==========================================');

    try {
        // 1. 验证版本
        const validation = validatePackageVersion(releaseBranch);

        console.log(`📌 Version Prefix: ${validation.versionPrefix}`);
        console.log(`📦 Expected Version: ${validation.expected}`);
        console.log(`📦 Actual Version: ${validation.actual}`);

        // 设置验证结果输出
        setGitHubOutput('version_valid', validation.valid.toString());
        setGitHubOutput('expected_version', validation.expected);
        setGitHubOutput('actual_version', validation.actual);

        if (!validation.valid) {
            console.log('==========================================');
            console.log('❌ Version validation failed');
            console.log(`   Expected: ${validation.expected}`);
            console.log(`   Actual: ${validation.actual}`);
            console.log('==========================================');
            process.exit(1);
        }

        console.log('✅ Version validation passed');

        // 2. 生成 tag 名称
        const newTag = `v${validation.expected}`;
        const newVersion = validation.expected;

        console.log('==========================================');
        console.log(`🏷️  Tag: ${newTag}`);
        console.log(`📦 Version: ${newVersion}`);
        console.log('==========================================');

        // 3. 创建 tag（带注释）
        exec(`git tag -a "${newTag}" -m "Release ${newVersion}"`);
        console.log(`✅ Tag ${newTag} created`);

        // 4. 设置输出
        setGitHubOutput('new_tag', newTag);
        setGitHubOutput('new_version', newVersion);

        console.log('==========================================');
        console.log('✅ Release tag created successfully');
        console.log('==========================================');
        process.exit(0);
    } catch (error) {
        console.error('==========================================');
        console.error(`❌ Error: ${error.message}`);
        console.error('==========================================');

        setGitHubOutput('version_valid', 'false');
        setGitHubOutput('expected_version', 'unknown');
        setGitHubOutput('actual_version', 'unknown');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };
