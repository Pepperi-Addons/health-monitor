import { PapiClient, Relation } from '@pepperi-addons/papi-sdk'
import { Client } from '@pepperi-addons/debug-server';

export class SettingsRelationService {

    papiClient: PapiClient
    bundleFileName = '';

    constructor(private client: Client) {
        this.papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey,
            actionUUID: client.ActionUUID
        });

        this.bundleFileName = `file_${this.client.AddonUUID}`;
    }

    // For page block template
    private async upsertRelation(relation): Promise<Relation> {
        return await this.papiClient.addons.data.relations.upsert(relation);
    }

    private getCommonRelationProperties(
        relationName: 'SettingsBlock' | 'PageBlock' | 'AddonBlock',
        blockRelationName: string,
        blockRelationDescription: string,
        blockName: string
    ): Relation {
        return {
            RelationName: relationName,
            Name: blockRelationName,
            Description: blockRelationDescription,
            Type: "NgComponent",
            SubType: "NG14",
            AddonUUID: this.client.AddonUUID,
            AddonRelativeURL: this.bundleFileName,
            ComponentName: `${blockName}Component`, // This is should be the block component name (from the client-side)
            ModuleName: `${blockName}Module`, // This is should be the block module name (from the client-side)
            ElementsModule: 'WebComponents',
            ElementName: `${blockName.toLocaleLowerCase()}-element-${this.client.AddonUUID}`,
        };
    }

    private async upsertSettingsRelation(blockRelationSlugName: string, blockRelationGroupName: string, blockRelationName: string, blockRelationDescription: string) {
        const blockName = 'Settings';

        const blockRelation: Relation = this.getCommonRelationProperties(
            'SettingsBlock',
            blockRelationName,
            blockRelationDescription,
            blockName);

        blockRelation['SlugName'] = blockRelationSlugName;
        blockRelation['GroupName'] = blockRelationGroupName;

        const res = await this.upsertRelation(blockRelation);
        return res;
    }

    async upsertRelations(): Promise<void> {
        // For settings block use this.
        const blockRelationSlugName = 'health_monitor_dashboard';
        const blockRelationGroupName = 'System Monitor';
        const blockRelationName = 'health-monitor-dashboard';
        const blockRelationDescription = 'settings relation to health monitor dashboard addon';
        try {
            await this.upsertSettingsRelation(blockRelationSlugName, blockRelationGroupName, blockRelationName, blockRelationDescription);
        } catch(err) {
            console.error(`Could not upsert relation ${blockRelationName} with error: ${err}`)
        }
    }
}
