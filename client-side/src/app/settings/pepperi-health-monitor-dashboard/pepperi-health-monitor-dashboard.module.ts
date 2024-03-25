import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import { TranslateModule } from '@ngx-translate/core';

import { PepNgxLibModule, PepAddonService } from '@pepperi-addons/ngx-lib';
import { PepTopBarModule } from '@pepperi-addons/ngx-lib/top-bar';
import { PepSizeDetectorModule } from '@pepperi-addons/ngx-lib/size-detector';
import { PepPageLayoutModule } from '@pepperi-addons/ngx-lib/page-layout';
import { PepIconRegistry, PepIconModule, pepIconSystemClose } from '@pepperi-addons/ngx-lib/icon';
import { MatTabsModule } from '@angular/material/tabs';


// import { PepButtonModule } from '@pepperi-addons/ngx-lib/button';
// import { PepDialogModule } from '@pepperi-addons/ngx-lib/dialog';
// import { PepMenuModule } from '@pepperi-addons/ngx-lib/menu';
// import { PepTextboxModule } from '@pepperi-addons/ngx-lib/textbox';

import { PepGenericListModule } from '@pepperi-addons/ngx-composite-lib/generic-list';

import { PepperiHealthMonitorDashboardComponent } from './pepperi-health-monitor-dashboard.component';
import { SyncDashboardModule } from '../sync-dashboard/sync-dashboard.module';
import { SyncLogsModule } from '../sync-logs/sync-logs.module';
import { InternalSyncLogsModule } from '../internal-sync-logs/internal-sync-logs.module';
import { KPIDashboardModule } from '../kpi-dashboard/kpi-dashboard.module';
import { PendingActionsModule } from '../pending-actions/pending-actions.module';

const pepIcons = [
    pepIconSystemClose,
];

export const routes: Routes = [
    {
        path: '',
        component: PepperiHealthMonitorDashboardComponent
    }
];

@NgModule({
    declarations: [
        PepperiHealthMonitorDashboardComponent
    ],
    imports: [
        CommonModule,
        SyncDashboardModule,
        SyncLogsModule,
        InternalSyncLogsModule,
        HttpClientModule,
        PepNgxLibModule,
        PepSizeDetectorModule,
        // PepIconModule,
        // PepDialogModule,
        PepTopBarModule,
        // PepMenuModule,
        PepPageLayoutModule,
        // PepButtonModule,
        // PepTextboxModule,
        PepGenericListModule,
        PendingActionsModule,
        MatTabsModule,
        KPIDashboardModule,
        TranslateModule.forChild(),
        RouterModule.forChild(routes)
    ],
    exports:[PepperiHealthMonitorDashboardComponent]
})
export class PepperiHealthMonitorDashboardModule {
    constructor(
        private pepIconRegistry: PepIconRegistry,
    ) {
        this.pepIconRegistry.registerIcons(pepIcons);
    }
}
