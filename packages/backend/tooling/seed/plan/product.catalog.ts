import { SeedCatalog, groupEntry } from './catalog.js';
import { identityContribution } from '../capability/identity/identity.contribution.js';
import { workspaceContribution } from '../capability/workspace/workspace.contribution.js';
import { governanceContribution } from '../capability/governance/governance.contribution.js';
import { materialContribution } from '../capability/material/material.contribution.js';
import { facilityContribution } from '../capability/facility/facility.contribution.js';
import { inventoryContribution } from '../capability/inventory/inventory.contribution.js';
import { approvalContribution } from '../capability/approval/approval.contribution.js';
import { attachmentContribution } from '../capability/attachment/attachment.contribution.js';
import {
    minimalGroup,
    materialDemoGroup,
    materialRegressionGroup,
    materialVolumeGroup,
    labDemoGroup,
} from '../group/material-demo.group.js';
import { governanceDemoGroup } from '../group/governance-demo.group.js';
import { businessDemoGroup } from '../group/business-demo.group.js';
import { governanceVolumeGroup, inventoryVolumeGroup } from '../group/volume.group.js';
import { credentialRegressionGroup } from '../group/credential-regression.group.js';
import { attachmentIntegrationGroup } from '../group/attachment-integration.group.js';

export const productSeedCatalog = new SeedCatalog(
    [
        identityContribution,
        workspaceContribution,
        governanceContribution,
        materialContribution,
        facilityContribution,
        inventoryContribution,
        approvalContribution,
        attachmentContribution,
    ],
    [
        groupEntry(minimalGroup),
        groupEntry(materialDemoGroup),
        groupEntry(materialRegressionGroup),
        groupEntry(materialVolumeGroup),
        groupEntry(labDemoGroup),
        groupEntry(governanceDemoGroup),
        groupEntry(businessDemoGroup),
        groupEntry(governanceVolumeGroup),
        groupEntry(inventoryVolumeGroup),
        groupEntry(credentialRegressionGroup),
        groupEntry(attachmentIntegrationGroup),
    ]
);
