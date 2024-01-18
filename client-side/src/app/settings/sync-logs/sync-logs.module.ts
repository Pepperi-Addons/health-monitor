import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

import { TranslateModule } from '@ngx-translate/core';

import { PepNgxLibModule, PepAddonService } from '@pepperi-addons/ngx-lib';
import { PepTopBarModule } from '@pepperi-addons/ngx-lib/top-bar';
import { PepSizeDetectorModule } from '@pepperi-addons/ngx-lib/size-detector';
import { PepPageLayoutModule } from '@pepperi-addons/ngx-lib/page-layout';
import { PepIconRegistry, PepIconModule, pepIconSystemClose } from '@pepperi-addons/ngx-lib/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { PepGenericListModule } from '@pepperi-addons/ngx-composite-lib/generic-list';
import { SyncLogsComponent } from './sync-logs.component';


const pepIcons = [
    pepIconSystemClose,
];

@NgModule({
    declarations: [
        SyncLogsComponent
    ],
    imports: [
        CommonModule,
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
        MatTabsModule,
        TranslateModule.forChild()
    ],
    exports:[SyncLogsComponent],    
})
export class SyncLogsModule {
    constructor(
        private pepIconRegistry: PepIconRegistry,
    ) {
        this.pepIconRegistry.registerIcons(pepIcons);
    }
}
