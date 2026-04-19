/**
 * Unit tests for the RecentConversations component.
 * Covers rendering, badge colours, relative timestamps, the "View all"
 * link, the empty state, and the hideClinic mode used by the clinic tab.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import RecentConversations, { type RecentConversation } from '@/components/dashboard/RecentConversations';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

const mockConversations: RecentConversation[] = [
  {
    _id: 'conv1',
    phase: 'confirmed',
    lastMessageAt: new Date(Date.now() - 86400000).toISOString(),
    clinicId: { _id: 'c1', name: 'Cardiff Physio' },
    leadId: { _id: 'l1', firstName: 'Sarah', lastName: 'Williams' },
  },
  {
    _id: 'conv2',
    phase: 'booking',
    lastMessageAt: new Date(Date.now() - 300000).toISOString(),
    clinicId: { _id: 'c2', name: 'Newport Sports' },
    leadId: { _id: 'l2', firstName: 'John', lastName: 'Davies' },
  },
  {
    _id: 'conv3',
    phase: 'declined',
    lastMessageAt: null,
    clinicId: null,
    leadId: null,
  },
];

describe('RecentConversations', () => {
  beforeEach(() => mockPush.mockClear());

  it('should render the heading', () => {
    render(<RecentConversations conversations={mockConversations} />);
    expect(screen.getByText('Recent Conversations')).toBeInTheDocument();
  });

  it('should render patient names from the conversation list', () => {
    render(<RecentConversations conversations={mockConversations} />);
    expect(screen.getByText('Sarah Williams')).toBeInTheDocument();
    expect(screen.getByText('John Davies')).toBeInTheDocument();
  });

  it('should fall back to "Unknown" when leadId is null', () => {
    render(<RecentConversations conversations={mockConversations} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('should display clinic names by default', () => {
    render(<RecentConversations conversations={mockConversations} />);
    expect(screen.getByText('Cardiff Physio')).toBeInTheDocument();
    expect(screen.getByText('Newport Sports')).toBeInTheDocument();
  });

  it('should hide clinic names when hideClinic is true', () => {
    render(<RecentConversations conversations={mockConversations} hideClinic />);
    expect(screen.queryByText('Cardiff Physio')).not.toBeInTheDocument();
  });

  it('should render phase badges with capitalised text', () => {
    render(<RecentConversations conversations={mockConversations} />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Booking')).toBeInTheDocument();
    expect(screen.getByText('Declined')).toBeInTheDocument();
  });

  it('should render "No messages yet" for null timestamps', () => {
    render(<RecentConversations conversations={mockConversations} />);
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });

  it('should render relative times for recent messages', () => {
    render(<RecentConversations conversations={mockConversations} />);
    // 5 minutes ago
    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
    // 1 day ago
    expect(screen.getByText('1 days ago')).toBeInTheDocument();
  });

  it('should link "View all" to the default /conversations path', () => {
    render(<RecentConversations conversations={mockConversations} />);
    const link = screen.getByText('View all').closest('a');
    expect(link).toHaveAttribute('href', '/conversations');
  });

  it('should accept a custom viewAllHref', () => {
    render(
      <RecentConversations
        conversations={mockConversations}
        viewAllHref="/conversations?clinic=Cardiff"
      />,
    );
    const link = screen.getByText('View all').closest('a');
    expect(link).toHaveAttribute('href', '/conversations?clinic=Cardiff');
  });

  it('should show empty state when no conversations', () => {
    render(<RecentConversations conversations={[]} />);
    expect(screen.getByText('No recent conversations.')).toBeInTheDocument();
  });

  it('should navigate to the conversation detail on row click', () => {
    render(<RecentConversations conversations={mockConversations} />);
    fireEvent.click(screen.getByText('Sarah Williams'));
    expect(mockPush).toHaveBeenCalledWith('/conversations/conv1');
  });

  it('should navigate on Enter key press', () => {
    render(<RecentConversations conversations={mockConversations} />);
    const row = screen.getByLabelText('Open conversation with Sarah Williams');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(mockPush).toHaveBeenCalledWith('/conversations/conv1');
  });

  it('should fall back to "Unknown clinic" when clinicId is null', () => {
    render(<RecentConversations conversations={mockConversations} />);
    expect(screen.getByText('Unknown clinic')).toBeInTheDocument();
  });
});
