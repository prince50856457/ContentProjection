import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Extractor } from './extractor';

describe('Extractor', () => {
  let component: Extractor;
  let fixture: ComponentFixture<Extractor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Extractor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Extractor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
