export const permissionModel = `
[request_definition]
r = sub, dom, permission
[policy_definition]
p = sub, dom, permission
[role_definition]
g = _, _, _
[policy_effect]
e = some(where (p.eft == allow))
[matchers]
m = r.dom == p.dom && r.permission == p.permission && g(r.sub, p.sub, r.dom)
`;
