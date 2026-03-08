import { render, screen, fireEvent } from '@testing-library/react';
import ClinicDetailTabs from './ClinicDetailTabs';

describe('ClinicDetailTabs', () => {
  /** Verifies all five tab buttons are rendered. */
  it('renders all tab buttons', () => {
    render(<ClinicDetailTabs />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('AI Configuration')).toBeInTheDocument();
    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  /** Verifies the Overview tab is active by default. */
  it('shows Overview content by default', () => {
    render(<ClinicDetailTabs />);

    expect(
      screen.getByText('Clinic overview would go here...'),
    ).toBeInTheDocument();
  });

  /** Verifies clicking a tab updates the displayed content. */
  it('switches content when a different tab is clicked', () => {
    render(<ClinicDetailTabs />);

    fireEvent.click(screen.getByText('Settings'));

    expect(
      screen.getByText('Clinic settings would go here...'),
    ).toBeInTheDocument();
  });

  /** Verifies each tab renders its matching placeholder content. */
  it('renders correct placeholder for every tab', () => {
    render(<ClinicDetailTabs />);

    const tabs = ['Overview', 'Settings', 'AI Configuration', 'Conversations', 'Analytics'];

    for (const tab of tabs) {
      fireEvent.click(screen.getByText(tab));
      expect(
        screen.getByText(`Clinic ${tab.toLowerCase()} would go here...`),
      ).toBeInTheDocument();
    }
  });
});
