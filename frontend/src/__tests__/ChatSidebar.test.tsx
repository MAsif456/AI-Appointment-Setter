import { render, screen } from '@testing-library/react';
import ChatSidebar, { LeadDetails, ClinicDetails } from '@/components/Conversations/ChatSidebar';

const mockLead: LeadDetails = {
  firstName: 'Sarah',
  lastName: 'Williams',
  phone: '07700 900123',
  email: 'sarah@email.com',
  issue: 'Back Pain',
  postcode: 'CF10 3AB',
  leadSource: 'facebook',
};

const mockClinic: ClinicDetails = {
  name: 'Cardiff Physiotherapy Centre',
  tone: 'friendly',
};

const defaultProps = {
  lead: mockLead,
  clinic: mockClinic,
  phase: 'greeting',
  messageCount: 3,
};

describe('ChatSidebar', () => {
  it('renders Patient Info heading', () => {
    render(<ChatSidebar {...defaultProps} />);
    expect(screen.getByText('Patient Info')).toBeInTheDocument();
  });

  it('renders lead name', () => {
    render(<ChatSidebar {...defaultProps} />);
    expect(screen.getByText('Sarah Williams')).toBeInTheDocument();
  });

  it('renders lead contact details', () => {
    render(<ChatSidebar {...defaultProps} />);
    expect(screen.getByText('07700 900123')).toBeInTheDocument();
    expect(screen.getByText('sarah@email.com')).toBeInTheDocument();
  });

  it('renders lead issue and postcode', () => {
    render(<ChatSidebar {...defaultProps} />);
    expect(screen.getByText('Back Pain')).toBeInTheDocument();
    expect(screen.getByText('CF10 3AB')).toBeInTheDocument();
  });
  it('renders lead source capitalised', () => {
    render(<ChatSidebar {...defaultProps} />);
    expect(screen.getByText('Facebook')).toBeInTheDocument();
  });

  it('renders phase badge with capitalised label', () => {
    render(<ChatSidebar {...defaultProps} phase="qualifying" />);
    expect(screen.getByText('Qualifying')).toBeInTheDocument();
  });

  it('renders clinic name in conversation status', () => {
    render(<ChatSidebar {...defaultProps} />);
    expect(screen.getByText('Cardiff Physiotherapy Centre')).toBeInTheDocument();
  });
  it('renders clinic tone capitalised', () => {
    render(<ChatSidebar {...defaultProps} />);
    expect(screen.getByText('Friendly')).toBeInTheDocument();
  });

  it('renders message count', () => {
    render(<ChatSidebar {...defaultProps} messageCount={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows loading text when lead is null', () => {
    render(<ChatSidebar {...defaultProps} lead={null} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('does not render clinic row when clinic is null', () => {
    render(<ChatSidebar {...defaultProps} clinic={null} />);
    expect(screen.queryByText('Cardiff Physiotherapy Centre')).not.toBeInTheDocument();
  });

  it('renders first name only when lastName is missing', () => {
    const leadNoLastName: LeadDetails = { firstName: 'John' };
    render(<ChatSidebar {...defaultProps} lead={leadNoLastName} />);
    expect(screen.getByText('John')).toBeInTheDocument();
  });
});
