import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PepperiHealthMonitorSettingsEditComponent } from './pepperi-health-monitor-settings-edit.component';

describe('PepperiHealthMonitorSettingsEditComponent', () => {
  let component: PepperiHealthMonitorSettingsEditComponent;
  let fixture: ComponentFixture<PepperiHealthMonitorSettingsEditComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PepperiHealthMonitorSettingsEditComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PepperiHealthMonitorSettingsEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
