import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PepperiHealthMonitorSettingsComponent } from './pepperi-health-monitor-settings.component';

describe('PepperiHealthMonitorSettingsComponent', () => {
  let component: PepperiHealthMonitorSettingsComponent;
  let fixture: ComponentFixture<PepperiHealthMonitorSettingsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PepperiHealthMonitorSettingsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PepperiHealthMonitorSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
