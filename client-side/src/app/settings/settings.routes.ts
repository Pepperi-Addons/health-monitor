import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

const routes: Routes = [
    {
        path: ':settingsSectionName/:addonUUID/:slugName',
        children: [
            {
                path: '**',
                loadChildren: () => import('./pepperi-health-monitor-dashboard/pepperi-health-monitor-dashboard.module').then(m => m.PepperiHealthMonitorDashboardModule),
            }
        ]
    }
];

@NgModule({
    imports: [
        RouterModule.forChild(routes),
    ],
    exports: [RouterModule]
})
export class SettingsRoutingModule { }



