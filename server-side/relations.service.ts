import { PapiClient, InstalledAddon } from '@pepperi-addons/papi-sdk'
import { Client } from '@pepperi-addons/debug-server'
import { Relation } from '@pepperi-addons/papi-sdk';
import MonitorSettingsService from './monitor-settings.service'
import { Utils } from './utils.service';
import { ErrorInterface, IsInstanceOfErrorInterface } from './error.interface';

export class RelationsService {

    readonly defaultTypeValue: string;
    papiClient: PapiClient;

    constructor(client: Client) {
        this.papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey
        });

        this.defaultTypeValue = 'SystemStatus';
    }

    getAddons(): Promise<InstalledAddon[]> {
        return this.papiClient.addons.installedAddons.find({});
    }

    async getErrorsFromHostees(monitorSettingsService: MonitorSettingsService, distributorCache): Promise<ErrorInterface[]> {
        let hosteesErrors: ErrorInterface[] = new Array;
        let getErrorTasks: Promise<any>[] = new Array;

        const relations = await this.papiClient.addons.data.relations.iter({ where: "RelationName='HealthMonitor'" });
        for await (const relation of relations) {
            getErrorTasks.push(this.createRelationPromise(relation, distributorCache));
        }

        await Promise.all(getErrorTasks).then(results => {
            hosteesErrors.push(...results.filter(value => value !== null))
        });

        return hosteesErrors;
    }

    createRelationPromise(relation: Relation, distributorCache): Promise<ErrorInterface | null> {
        return new Promise(async (resolve) => {
            try {
                const hosteesData = await this.callHostees(relation, distributorCache);
                resolve(hosteesData);
            }
            catch (error) {
                // Promise.all() will reject immediately upon any of the input promises rejecting.
                // To avoid this we handle the error inside the promise.
                console.error(Utils.GetErrorDetailsSafe(error));
                resolve(null)
            }
        });
    }

    async callHostees(relation: Relation, distributorCache): Promise<ErrorInterface> {
        const url = `/addons/api/${relation.AddonUUID}${relation.AddonRelativeURL?.startsWith('/') ? relation.AddonRelativeURL : '/' + relation.AddonRelativeURL}`;
        const response = await this.papiClient.get(url);

        // Fill missing values with default values
        if (!('Type' in response)) {
            response['Type'] = this.defaultTypeValue;
        }

        response['Name'] = distributorCache.Name;
        response['DistributorID'] = distributorCache.InternalID;
        response['AddonUUID'] = relation.AddonUUID;

        // Validating reponse
        if (!IsInstanceOfErrorInterface(response)) {
            const errorJson = {
                RelationName: relation.Name,
                AddonUUID: relation.AddonUUID,
                Response: response,
            }
            throw new Error(`${JSON.stringify(errorJson)}`)
        }

        return response as ErrorInterface;
    }
}

export default RelationsService;