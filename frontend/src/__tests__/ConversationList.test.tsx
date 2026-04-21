import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConversationList from '@/components/Conversations/ConversationList';
import api from '@/lib/apiAxios';

// Mock the API
jest.mock('@/lib/apiAxios');
const mockedApi = api as jest.Mocked<typeof api>;

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock conversation data that matches your component's interface
const mockConversations = [
  {
    _id: 'conv_001',
    phase: 'booking',
    isHighPriority: false,
    lastMessageAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    clinicId: { _id: 'c1', name: 'Cardiff Physiotherapy Centre' },
    leadId: { _id: 'l1', firstName: 'Rachel', lastName: 'Green', phone: '07700 900001' },
    channel: 'WhatsApp',
  },
  {
    _id: 'conv_002',
    phase: 'confirmed',
    isHighPriority: false,
    lastMessageAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    clinicId: { _id: 'c1', name: 'Cardiff Physiotherapy Centre' },
    leadId: { _id: 'l2', firstName: 'Sarah', lastName: 'Williams', phone: '07700 900002' },
    channel: 'Facebook Ads',
  },
  {
    _id: 'conv_003',
    phase: 'qualified',
    isHighPriority: false,
    lastMessageAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    clinicId: { _id: 'c2', name: 'Bristol Wellness Clinic' },
    leadId: { _id: 'l3', firstName: 'John', lastName: 'Davies', phone: '07700 900003' },
    channel: 'SMS',
  },
  {
    _id: 'conv_004',
    phase: 'declined',
    isHighPriority: false,
    lastMessageAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    clinicId: { _id: 'c1', name: 'Cardiff Physiotherapy Centre' },
    leadId: { _id: 'l4', firstName: 'Lisa', lastName: 'Evans', phone: '07700 900004' },
    channel: 'Instagram',
  },
];

describe('ConversationList', () => {
  beforeEach(() => {
    mockPush.mockClear();
    jest.clearAllMocks();
    // Mock successful API response
    mockedApi.get.mockResolvedValue({ data: mockConversations } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the page title', async () => {
    render(<ConversationList />);
    expect(screen.getByText('Conversations')).toBeInTheDocument();
  });

  it('renders exactly 4 conversation rows', async () => {
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Sarah Williams')).toBeInTheDocument();
    expect(screen.getByText('John Davies')).toBeInTheDocument();
    expect(screen.getByText('Lisa Evans')).toBeInTheDocument();
  });

  it('renders one phase badge per phase', async () => {
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    });
    
    expect(screen.getAllByText('Booking').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Qualified').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Declined').length).toBeGreaterThanOrEqual(1);
  });

  it('does not show high priority icon when no conversations are urgent', async () => {
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    });
    
    const rachelRow = screen.getByText('Rachel Green').closest('tr');
    expect(rachelRow).toBeInTheDocument();
    
    // No priority icon SVG in the name cell when not high priority
    const nameCell = rachelRow!.querySelector('td');
    const svgs = nameCell!.querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });

  it('does not show the high priority banner when no urgent cases exist', async () => {
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    });
    
    expect(screen.queryByText(/high priority/)).not.toBeInTheDocument();
  });

  it('does not show an intervention alert banner', async () => {
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    });
    
    expect(
      screen.queryByText(/need human intervention/i),
    ).not.toBeInTheDocument();
  });

  it('filters by search input', async () => {
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText(
      'Search by name or phone...',
    );
    fireEvent.change(searchInput, { target: { value: 'Sarah' } });
    
    expect(screen.getByText('Sarah Williams')).toBeInTheDocument();
    expect(screen.queryByText('Rachel Green')).not.toBeInTheDocument();
  });

  it('navigates to conversation detail on row click', async () => {
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText('Sarah Williams')).toBeInTheDocument();
    });
    
    const row = screen.getByText('Sarah Williams').closest('tr');
    if (row) fireEvent.click(row);
    
    expect(mockPush).toHaveBeenCalledWith('/conversations/conv_002');
  });

  it('renders clinic and lead source columns', async () => {
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    });
    
    expect(
      screen.getAllByText('Cardiff Physiotherapy Centre').length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Facebook Ads')).toBeInTheDocument();
  });

  it('does not display any AI model references', async () => {
    const { container } = render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    });
    
    const text = container.textContent ?? '';
    expect(text).not.toContain('Groq');
    expect(text).not.toContain('Llama');
    expect(text).not.toContain('GPT');
  });

  it('does not render the Live AI Chat Demo button', async () => {
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    });
    
    expect(screen.queryByText('Live AI Chat Demo')).not.toBeInTheDocument();
  });

  it('renders pagination controls', async () => {
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    });
    
    expect(screen.getByText(/of \d+/)).toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<ConversationList />);
    expect(screen.getByText('Loading conversations...')).toBeInTheDocument();
  });

  it('shows error message when API fails', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('Network error'));
    
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load conversations/)).toBeInTheDocument();
    });
  });

  it('filters by clinic', async () => {
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    });
    
    const clinicSelect = screen.getAllByRole('combobox')[0]; // First select is clinic filter
    fireEvent.change(clinicSelect, { target: { value: 'Bristol Wellness Clinic' } });
    
    expect(screen.getByText('John Davies')).toBeInTheDocument();
    expect(screen.queryByText('Rachel Green')).not.toBeInTheDocument();
  });

  it('filters by phase', async () => {
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    });
    
    const phaseSelect = screen.getAllByRole('combobox')[1]; // Second select is phase filter
    fireEvent.change(phaseSelect, { target: { value: 'confirmed' } });
    
    expect(screen.getByText('Sarah Williams')).toBeInTheDocument();
    expect(screen.queryByText('Rachel Green')).not.toBeInTheDocument();
  });

  it('shows high priority banner when urgent cases exist', async () => {
    const urgentConversations = [
      {
        ...mockConversations[0],
        isHighPriority: true,
      },
      ...mockConversations.slice(1),
    ];
    
    mockedApi.get.mockResolvedValueOnce({ data: urgentConversations } as any);
    
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText(/1 high priority/)).toBeInTheDocument();
    });
  });

  it('shows high priority icon for urgent conversations', async () => {
    const urgentConversations = [
      {
        ...mockConversations[0],
        isHighPriority: true,
      },
      ...mockConversations.slice(1),
    ];
    
    mockedApi.get.mockResolvedValueOnce({ data: urgentConversations } as any);
    
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    });
    
    const rachelRow = screen.getByText('Rachel Green').closest('tr');
    const nameCell = rachelRow!.querySelector('td');
    const svgs = nameCell!.querySelectorAll('svg');
    
    // Should have priority icon
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('shows message when no conversations match filters', async () => {
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search by name or phone...');
    fireEvent.change(searchInput, { target: { value: 'NonExistentName' } });
    
    expect(screen.getByText(/No conversations found matching your filters/)).toBeInTheDocument();
  });

  it('calls API on mount', async () => {
    render(<ConversationList />);
    
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/conversations');
    });
  });

  it('formats time correctly for recent messages', async () => {
    render(<ConversationList />);

    await waitFor(() => {
      expect(screen.getByText('Rachel Green')).toBeInTheDocument();
    });

    // Should show time in "Xm ago" or "Xh ago" format - use getAllByText since there are multiple
    const timeElements = screen.getAllByText(/\d+m ago|\d+h ago|\d+d ago/);
    expect(timeElements.length).toBeGreaterThan(0);
    expect(timeElements[0]).toBeInTheDocument();
  });

  it('sorts urgent conversations before non-urgent ones', async () => {
    // Lisa (last item, 1 day ago) is urgent; Rachel (first item, 5min ago) is not
    const urgentConversations = [
      { ...mockConversations[0], isHighPriority: false }, // Rachel — 5m ago
      { ...mockConversations[1], isHighPriority: false }, // Sarah — 1h ago
      { ...mockConversations[2], isHighPriority: false }, // John — 2h ago
      { ...mockConversations[3], isHighPriority: true },  // Lisa — 1d ago, URGENT
    ];

    mockedApi.get.mockResolvedValueOnce({ data: urgentConversations } as any);

    render(<ConversationList />);

    await waitFor(() => {
      expect(screen.getByText('Lisa Evans')).toBeInTheDocument();
    });

    // Get all table rows (tbody tr)
    const rows = screen.getAllByRole('row').filter((r) => r.closest('tbody'));
    const firstRowText = rows[0]?.textContent ?? '';

    // Lisa should be first because she's high priority
    expect(firstRowText).toContain('Lisa Evans');
  });
});