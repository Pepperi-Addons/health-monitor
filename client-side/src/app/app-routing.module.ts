import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PepperiListExampleComponent } from './pepperi-list-example/pepperi-list-example.component';
import { PepperiNgxLibExamplesComponent } from './pepperi-ngx-lib-examples/pepperi-ngx-lib-examples.component'
import { PepperiHealthMonitorSettingsComponent } from './pepperi-health-monitor-settings/pepperi-health-monitor-settings.component'
import { PepperiHealthMonitorSettingsEditComponent } from './pepperi-health-monitor-settings-edit/pepperi-health-monitor-settings-edit.component'
import { PepperiHealthMonitorDashboardComponent } from './pepperi-health-monitor-dashboard/pepperi-health-monitor-dashboard.component'
import { EmptyRouteComponent } from './empty-route/empty-route.component';
// import * as config from '../../../addon.config.json';

const routes: Routes = [
    {
        path: `settings/7e15d4cc-55a7-4128-a9fe-0e877ba90069/ngx-lib-components`,
        component: PepperiNgxLibExamplesComponent
    },
    {
        path: `settings/7e15d4cc-55a7-4128-a9fe-0e877ba90069/ngx-lib-list`,
        component: PepperiListExampleComponent
    },
    {
        path: `settings/7e15d4cc-55a7-4128-a9fe-0e877ba90069/health-monitor-settings`,
        component: PepperiHealthMonitorSettingsComponent
    },
    {
        path: `settings/7e15d4cc-55a7-4128-a9fe-0e877ba90069/health-monitor-settings-edit`,
        component: PepperiHealthMonitorSettingsEditComponent
    },
    {
        path: `settings/7e15d4cc-55a7-4128-a9fe-0e877ba90069/health-monitor-dashboard`,
        component: PepperiHealthMonitorDashboardComponent
    }
    // {
    //   path: 'settings/95501678-6687-4fb3-92ab-1155f47f839e/themes',
    //   loadChildren: () => import('./plugin/plugin.module').then(m => m.PluginModule)
    // },
    // {
    //   path: '',
    //   loadChildren: () => import('./plugin/plugin.module').then(m => m.PluginModule)
    // },

];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule { }
