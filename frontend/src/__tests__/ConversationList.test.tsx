import { render, screen, fireEvent } from '@testing-library/react';
import ConversationList from '@/components/Conversations/ConversationList';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('ConversationList', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders the page title', () => {
    render(<ConversationList />);
    expect(screen.getByText('Conversations')).toBeInTheDocument();
  });

  it('renders exactly 4 conversation rows', () => {
    render(<ConversationList />);
    expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    expect(screen.getByText('Sarah Williams')).toBeInTheDocument();
    expect(screen.getByText('John Davies')).toBeInTheDocument();
    expect(screen.getByText('Lisa Evans')).toBeInTheDocument();
  });

  it('renders one phase badge per phase', () => {
    render(<ConversationList />);
    expect(screen.getAllByText('Booking').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Qualified').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Declined').length).toBeGreaterThanOrEqual(1);
  });

  it('shows high priority icon for priority conversations', () => {
    const { container } = render(<ConversationList />);
    // The HighPriorityIcon renders SVG elements in the name cell
    const rachelRow = screen.getByText('Rachel Green').closest('tr');
    expect(rachelRow).toBeInTheDocument();
    const svgs = rachelRow!.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it('shows the high priority alert banner', () => {
    render(<ConversationList />);
    expect(screen.getByText(/high priority/)).toBeInTheDocument();
  });

  it('does not show an intervention alert banner', () => {
    render(<ConversationList />);
    expect(
      screen.queryByText(/need human intervention/i),
    ).not.toBeInTheDocument();
  });

  it('filters by search input', () => {
    render(<ConversationList />);
    const searchInput = screen.getByPlaceholderText(
      'Search by name or phone...',
    );
    fireEvent.change(searchInput, { target: { value: 'Sarah' } });
    expect(screen.getByText('Sarah Williams')).toBeInTheDocument();
    expect(screen.queryByText('Rachel Green')).not.toBeInTheDocument();
  });

  it('navigates to conversation detail on row click', () => {
    render(<ConversationList />);
    const row = screen.getByText('Sarah Williams').closest('tr');
    if (row) fireEvent.click(row);
    expect(mockPush).toHaveBeenCalledWith('/conversations/conv_002');
  });

  it('renders clinic and lead source columns', () => {
    render(<ConversationList />);
    expect(
      screen.getAllByText('Cardiff Physiotherapy Centre').length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Facebook Ads')).toBeInTheDocument();
  });

  it('does not display any AI model references', () => {
    const { container } = render(<ConversationList />);
    const text = container.textContent ?? '';
    expect(text).not.toContain('Groq');
    expect(text).not.toContain('Llama');
    expect(text).not.toContain('GPT');
  });

  it('does not render the Live AI Chat Demo button', () => {
    render(<ConversationList />);
    expect(screen.queryByText('Live AI Chat Demo')).not.toBeInTheDocument();
  });

  it('renders pagination controls', () => {
    render(<ConversationList />);
    expect(screen.getByText(/of \d+/)).toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeInTheDocument();
  });
});
