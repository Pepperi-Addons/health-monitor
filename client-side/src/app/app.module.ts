import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { PepperiHealthMonitorSettingsComponent } from './pepperi-health-monitor-settings/pepperi-health-monitor-settings.component';
import { PepperiHealthMonitorSettingsEditComponent } from './pepperi-health-monitor-settings-edit/pepperi-health-monitor-settings-edit.component';
import { PepperiHealthMonitorDashboardComponent } from './pepperi-health-monitor-dashboard/pepperi-health-monitor-dashboard.component';
import { PepUIModule } from './modules/pepperi.module';
import { MaterialModule } from './modules/material.module';

@NgModule({
    declarations: [
        AppComponent,
        PepperiHealthMonitorSettingsComponent,
        PepperiHealthMonitorSettingsEditComponent,
        PepperiHealthMonitorDashboardComponent
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        AppRoutingModule,
        PepUIModule,
        MaterialModule
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule {
}




