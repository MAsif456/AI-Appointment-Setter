/**
 * Render tests for all exported icon components.
 * Ensures every icon renders an SVG and forwards the className prop.
 */
import React from 'react';
import { render } from '@testing-library/react';
import {
  DashboardIcon,
  ClinicsIcon,
  ConversationsIcon,
  AnalyticsIcon,
  SettingsIcon,
  UserIcon,
  BackArrowIcon,
  LogoutIcon,
} from '@/components/Icons';

const icons = [
  { name: 'DashboardIcon', Component: DashboardIcon },
  { name: 'ClinicsIcon', Component: ClinicsIcon },
  { name: 'ConversationsIcon', Component: ConversationsIcon },
  { name: 'AnalyticsIcon', Component: AnalyticsIcon },
  { name: 'SettingsIcon', Component: SettingsIcon },
  { name: 'UserIcon', Component: UserIcon },
  { name: 'BackArrowIcon', Component: BackArrowIcon },
  { name: 'LogoutIcon', Component: LogoutIcon },
];

describe('Icon components', () => {
  it.each(icons)('$name should render an SVG element', ({ Component }) => {
    const { container } = render(<Component />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it.each(icons)('$name should forward className to the SVG', ({ Component }) => {
    const { container } = render(<Component className="test-class" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toBe('test-class');
  });
});
