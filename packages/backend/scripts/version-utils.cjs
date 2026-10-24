#!/usr/bin/env node

/**
 * Version Utilities
 *
 * 共用的版本相关工具函数，供其他脚本使用
 */

const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 执行 shell 命令并返回输出
 */
function exec(command, options = {}) {
    try {
        const result = execSync(command, {
            encoding: 'utf8',
            stdio: options.silent ? 'pipe' : 'inherit',
            ...options,
        });
        return result ? result.trim() : '';
    } catch (error) {
        if (options.ignoreError) {
            return '';
        }
        throw error;
    }
}

/**
 * 安全地执行 git 命令（防止命令注入）
 */
function execGit(args, options = {}) {
    try {
        const result = execFileSync('git', args, {
            encoding: 'utf8',
            stdio: options.silent ? 'pipe' : 'inherit',
            ...options,
        });
        return result ? result.trim() : '';
    } catch (error) {
        if (options.ignoreError) {
            return '';
        }
        throw error;
    }
}

/**
 * 验证版本前缀格式是否安全（只允许 X.Y 格式）
 * @param {string} versionPrefix - 待验证的版本前缀
 * @throws {Error} 如果格式不合法
 */
function validateVersionPrefixFormat(versionPrefix) {
    const validPattern = /^[0-9]+\.[0-9]+$/;
    if (!validPattern.test(versionPrefix)) {
        throw new Error(
            `Invalid version prefix format: "${versionPrefix}". Expected format: X.Y (e.g., 1.0, 2.15)`
        );
    }
}

/**
 * 从 release 分支名提取版本前缀
 * @param {string} branchName - release 分支名（如 release/1.0）
 * @returns {string} 版本前缀（如 1.0）
 * @example extractVersionPrefix('release/1.12') // => '1.12'
 */
function extractVersionPrefix(branchName) {
    if (!branchName.startsWith('release/')) {
        throw new Error(`Invalid branch name: ${branchName}. Expected format: release/X.Y`);
    }
    const versionPrefix = branchName.replace('release/', '');

    // 安全验证：防止命令注入
    validateVersionPrefixFormat(versionPrefix);

    return versionPrefix;
}

/**
 * 获取指定版本前缀的所有现有标签
 * @param {string} versionPrefix - 版本前缀（如 1.0）
 * @returns {string[]} 符合格式的 tag 列表（如 ['v1.0.0', 'v1.0.1']）
 */
function getExistingTags(versionPrefix) {
    // 安全验证：防止命令注入
    validateVersionPrefixFormat(versionPrefix);

    // 使用 execFileSync 传递参数数组，防止命令注入
    const tagPattern = `v${versionPrefix}.*`;
    const tags = execGit(['tag', '-l', tagPattern], { silent: true, ignoreError: true });

    if (!tags) {
        return [];
    }

    // 过滤出符合 v1.0.0 格式的标签（排除快照标签）
    const regex = new RegExp(`^v${versionPrefix.replace('.', '\\.')}\\.[0-9]+$`);
    return tags
        .split('\n')
        .filter((tag) => regex.test(tag))
        .sort((a, b) => {
            const aPatch = parseInt(a.split('.').pop());
            const bPatch = parseInt(b.split('.').pop());
            return aPatch - bPatch;
        });
}

/**
 * 计算下一个 patch 版本号
 * @param {string[]} existingTags - 现有的 tag 列表
 * @param {string} versionPrefix - 版本前缀
 * @returns {number} 下一个 patch 号
 */
function calculateNextPatch(existingTags, versionPrefix) {
    if (existingTags.length === 0) {
        return 0;
    }

    const latestTag = existingTags[existingTags.length - 1];
    const latestPatch = parseInt(latestTag.replace(`v${versionPrefix}.`, ''));
    return latestPatch + 1;
}

/**
 * 读取 package.json 中的版本号
 * @returns {string} 版本号（如 '1.0.0'）
 */
function getPackageVersion() {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version;
}

/**
 * 验证 package.json 版本是否符合预期
 * @param {string} releaseBranch - release 分支名
 * @returns {{ valid: boolean, expected: string, actual: string, versionPrefix: string, nextPatch: number }}
 */
function validatePackageVersion(releaseBranch) {
    try {
        const versionPrefix = extractVersionPrefix(releaseBranch);
        const existingTags = getExistingTags(versionPrefix);
        const nextPatch = calculateNextPatch(existingTags, versionPrefix);
        const expectedVersion = `${versionPrefix}.${nextPatch}`;
        const actualVersion = getPackageVersion();

        return {
            valid: actualVersion === expectedVersion,
            expected: expectedVersion,
            actual: actualVersion,
            versionPrefix,
            nextPatch,
        };
    } catch (error) {
        throw new Error(`Version validation failed: ${error.message}`);
    }
}

/**
 * 设置 GitHub Actions 输出
 * @param {string} name - 输出变量名
 * @param {string} value - 输出值
 */
function setGitHubOutput(name, value) {
    const githubOutput = process.env.GITHUB_OUTPUT;
    if (githubOutput) {
        fs.appendFileSync(githubOutput, `${name}=${value}\n`);
    }
}

module.exports = {
    exec,
    execGit,
    extractVersionPrefix,
    getExistingTags,
    calculateNextPatch,
    getPackageVersion,
    validatePackageVersion,
    setGitHubOutput,
    validateVersionPrefixFormat,
};
