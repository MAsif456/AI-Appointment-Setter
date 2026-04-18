import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import GdprPanel from '@/components/Conversations/GdprPanel';
import api from '@/lib/apiAxios';

jest.mock('@/lib/apiAxios');
const mockedApi = api as jest.Mocked<typeof api>;

// Mock useAuth — controls isAdmin per test
const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const LEAD_ID = 'lead123';

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ isAdmin: false, isAuthenticated: true, user: null, loading: false });
});

describe('GdprPanel', () => {
  it('renders the Data Protection heading', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] } as any);

    render(<GdprPanel leadId={LEAD_ID} />);

    expect(screen.getByText('Data Protection')).toBeInTheDocument();
  });

  it('shows loading state then "No consent records" when empty', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] } as any);

    render(<GdprPanel leadId={LEAD_ID} />);

    // Initially shows loading
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('No consent records found.')).toBeInTheDocument();
    });
  });

  it('fetches and displays consent history', async () => {
    const consentRecords = [
      { _id: 'c1', status: 'granted', consentStatementVersion: '1.0.0', channel: 'sms', createdAt: '2026-01-15T10:00:00Z' },
      { _id: 'c2', status: 'withdrawn', consentStatementVersion: '1.0.0', channel: 'sms', createdAt: '2026-02-20T14:00:00Z' },
    ];
    mockedApi.get.mockResolvedValueOnce({ data: consentRecords } as any);

    render(<GdprPanel leadId={LEAD_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Granted')).toBeInTheDocument();
      expect(screen.getByText('Withdrawn')).toBeInTheDocument();
    });
  });

  it('handles consent fetch error gracefully', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('Network error'));

    render(<GdprPanel leadId={LEAD_ID} />);

    await waitFor(() => {
      expect(screen.getByText('No consent records found.')).toBeInTheDocument();
    });
  });

  it('shows "Request Data Deletion" button for non-admin users', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] } as any);

    render(<GdprPanel leadId={LEAD_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Request Data Deletion')).toBeInTheDocument();
    });
  });

  it('shows "Delete Patient Data" button for admin users', async () => {
    mockUseAuth.mockReturnValue({ isAdmin: true, isAuthenticated: true, user: null, loading: false });
    mockedApi.get.mockResolvedValueOnce({ data: [] } as any);

    render(<GdprPanel leadId={LEAD_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Delete Patient Data')).toBeInTheDocument();
    });
  });

  it('opens confirmation dialog on delete button click', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] } as any);

    render(<GdprPanel leadId={LEAD_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Request Data Deletion')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Request Data Deletion'));

    expect(screen.getByText(/erasure request to an admin/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Reason for erasure request...')).toBeInTheDocument();
  });

  it('shows cancel button in confirmation dialog', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] } as any);

    render(<GdprPanel leadId={LEAD_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Request Data Deletion')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Request Data Deletion'));

    fireEvent.click(screen.getByText('Cancel'));

    // Should be back to the main button
    expect(screen.getByText('Request Data Deletion')).toBeInTheDocument();
  });

  it('submits erasure request for staff with reason', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] } as any);
    mockedApi.post.mockResolvedValueOnce({ data: {} } as any);
    // Second consent fetch after submission
    mockedApi.get.mockResolvedValueOnce({ data: [] } as any);

    render(<GdprPanel leadId={LEAD_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Request Data Deletion')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Request Data Deletion'));

    const textarea = screen.getByPlaceholderText('Reason for erasure request...');
    fireEvent.change(textarea, { target: { value: 'Patient requested' } });
    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(screen.getByText('Erasure request submitted. Awaiting admin approval.')).toBeInTheDocument();
    });

    expect(mockedApi.post).toHaveBeenCalledWith(
      `/gdpr/erasure-requests/${LEAD_ID}`,
      { reason: 'Patient requested' },
    );
  });

  it('submits direct erasure for admin', async () => {
    mockUseAuth.mockReturnValue({ isAdmin: true, isAuthenticated: true, user: null, loading: false });
    mockedApi.get.mockResolvedValueOnce({ data: [] } as any);
    mockedApi.delete.mockResolvedValueOnce({ data: {} } as any);
    // Second consent fetch after submission
    mockedApi.get.mockResolvedValueOnce({ data: [] } as any);

    render(<GdprPanel leadId={LEAD_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Delete Patient Data')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete Patient Data'));

    // Admin sees different confirmation text, no reason textarea
    expect(screen.getByText(/permanently anonymise/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Confirm Delete'));

    await waitFor(() => {
      expect(screen.getByText('Patient data erased successfully.')).toBeInTheDocument();
    });

    expect(mockedApi.delete).toHaveBeenCalledWith(`/gdpr/erasure/${LEAD_ID}`);
  });

  it('shows error message when erasure request fails', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] } as any);
    mockedApi.post.mockRejectedValueOnce({
      response: { data: { message: 'Lead not found' } },
    });

    render(<GdprPanel leadId={LEAD_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Request Data Deletion')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Request Data Deletion'));

    const textarea = screen.getByPlaceholderText('Reason for erasure request...');
    fireEvent.change(textarea, { target: { value: 'Patient asked' } });
    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(screen.getByText('Lead not found')).toBeInTheDocument();
    });
  });

  it('disables submit button when staff has not entered a reason', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] } as any);

    render(<GdprPanel leadId={LEAD_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Request Data Deletion')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Request Data Deletion'));

    const submitBtn = screen.getByText('Submit Request');
    expect(submitBtn).toBeDisabled();
  });

  it('shows generic error when response has no message', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] } as any);
    mockedApi.post.mockRejectedValueOnce(new Error('Network error'));

    render(<GdprPanel leadId={LEAD_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Request Data Deletion')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Request Data Deletion'));

    const textarea = screen.getByPlaceholderText('Reason for erasure request...');
    fireEvent.change(textarea, { target: { value: 'Reason' } });
    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(screen.getByText('Request failed.')).toBeInTheDocument();
    });
  });
});
