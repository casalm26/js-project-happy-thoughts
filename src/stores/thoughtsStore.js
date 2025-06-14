import { create } from 'zustand';
import { API_URL } from '../config/api';
import { authenticatedFetch } from '../utils/authUtils';
import { 
  processThought, 
  createOptimisticThought, 
  createOptimisticLikeUpdate, 
  reinsertThought,
  handleApiError,
  extractErrorMessage,
  createOptimisticUpdater,
  createRemoveUpdater,
  createReplaceUpdater
} from '../utils/thoughtUtils';

const PAGE_SIZE = 10;

/**
 * Zustand store for managing thoughts state and operations
 */
export const useThoughtsStore = create((set, get) => ({
  // State
  thoughts: [],
  loading: false,
  error: '',
  currentPage: 1,
  totalPages: 1,
  totalThoughts: 0,
  hasMore: true,
  viewMode: 'pagination', // 'pagination' or 'infinite'
  thoughtFilter: 'all', // 'all' or 'my'

  // Actions
  fetchThoughts: async (page = 1, append = false) => {
    set({ loading: true, error: '' });
    
    try {
      const { thoughtFilter } = get();
      const endpoint = thoughtFilter === 'my' 
        ? `${API_URL}/users/me/thoughts?page=${page}&limit=${PAGE_SIZE}`
        : `${API_URL}/thoughts?page=${page}&limit=${PAGE_SIZE}`;
      
      const fetchFunction = thoughtFilter === 'my' ? authenticatedFetch : fetch;
      const response = await fetchFunction(endpoint);
      
      if (!response.ok) {
        throw new Error('Failed to fetch thoughts');
      }
      
      const data = await response.json();
      const thoughtsArray = data.thoughts || data;
      const processedThoughts = thoughtsArray.map(processThought);
      
      // Use new pagination structure if available
      const pagination = data.pagination || {};
      const total = data.total || thoughtsArray.length;
      const currentPage = pagination.currentPage || page;
      const totalPages = pagination.totalPages || Math.ceil(total / PAGE_SIZE);
      const hasMore = pagination.hasNextPage !== undefined
        ? pagination.hasNextPage
        : (processedThoughts.length === PAGE_SIZE);
      
      set((state) => ({ 
        thoughts: append ? [...state.thoughts, ...processedThoughts] : processedThoughts,
        currentPage,
        totalPages,
        totalThoughts: total,
        hasMore
      }));
    } catch {
      set({ error: 'Could not load happy thoughts. Please try again later.' });
    } finally {
      set({ loading: false });
    }
  },

  addThought: async (message, onError) => {
    set({ error: '', loading: true });
    
    const optimisticThought = createOptimisticThought(message);
    set((state) => ({ thoughts: [optimisticThought, ...state.thoughts] }));
    
    try {
      const response = await authenticatedFetch(`${API_URL}/thoughts`, {
        method: 'POST',
        body: JSON.stringify({ message })
      });
      
      const data = await response.json();
      
      if (response.ok && data.message && data._id) {
        const processedThought = processThought(data);
        set((state) => ({ thoughts: createReplaceUpdater(optimisticThought._id, processedThought)(state.thoughts) }));
      } else {
        set((state) => ({ thoughts: createRemoveUpdater(optimisticThought._id)(state.thoughts) }));
        const errorMessage = extractErrorMessage(data, 'Invalid input');
        if (onError) onError(errorMessage);
      }
    } catch (error) {
      set((state) => ({ thoughts: createRemoveUpdater(optimisticThought._id)(state.thoughts) }));
      const errorMessage = handleApiError(
        error,
        'Could not post your thought. Please try again.',
        'Please log in to post a thought'
      );
      
      if (error.message === 'Authentication required' && onError) {
        onError(errorMessage);
      } else {
        set({ error: errorMessage });
      }
    } finally {
      set({ loading: false });
    }
  },

  handleLike: async (thoughtId) => {
    const { thoughts } = get();
    const currentThought = thoughts.find(thought => thought._id === thoughtId);
    if (!currentThought) return;

    const optimisticUpdate = createOptimisticLikeUpdate(currentThought);
    set((state) => ({ thoughts: createOptimisticUpdater(thoughtId, () => optimisticUpdate)(state.thoughts) }));

    try {
      const response = await authenticatedFetch(`${API_URL}/thoughts/${thoughtId}/like`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const updatedThought = await response.json();
        const processedThought = processThought(updatedThought);
        set((state) => ({ thoughts: createReplaceUpdater(updatedThought._id, processedThought)(state.thoughts) }));
        return updatedThought._id;
      } else {
        throw new Error('Failed to update like status');
      }
    } catch (error) {
      set((state) => ({ thoughts: createOptimisticUpdater(thoughtId, () => currentThought)(state.thoughts) }));
      const errorMessage = handleApiError(
        error,
        'Could not like the thought. Please try again.',
        'Please log in to like thoughts.'
      );
      set({ error: errorMessage });
      throw error;
    }
  },

  updateThought: async (thoughtId, message) => {
    const { thoughts } = get();
    const currentThought = thoughts.find(thought => thought._id === thoughtId);
    if (!currentThought) {
      return { success: false, error: 'Thought not found' };
    }

    const optimisticUpdate = { ...currentThought, message, isOptimistic: true };
    set((state) => ({ thoughts: createOptimisticUpdater(thoughtId, () => optimisticUpdate)(state.thoughts) }));

    try {
      const response = await authenticatedFetch(`${API_URL}/thoughts/${thoughtId}`, {
        method: 'PUT',
        body: JSON.stringify({ message })
      });
      
      if (response.ok) {
        const updatedThought = await response.json();
        const processedThought = processThought(updatedThought);
        set((state) => ({ thoughts: createReplaceUpdater(updatedThought._id, processedThought)(state.thoughts) }));
        return { success: true, thought: processedThought };
      } else {
        set((state) => ({ thoughts: createOptimisticUpdater(thoughtId, () => currentThought)(state.thoughts) }));
        const errorData = await response.json();
        const errorMessage = extractErrorMessage(errorData, 'Failed to update thought');
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      set((state) => ({ thoughts: createOptimisticUpdater(thoughtId, () => currentThought)(state.thoughts) }));
      const errorMessage = handleApiError(
        error,
        'Could not update the thought. Please try again.',
        'Please log in to edit thoughts.'
      );
      return { success: false, error: errorMessage };
    }
  },

  deleteThought: async (thoughtId) => {
    const { thoughts } = get();
    const thoughtToDelete = thoughts.find(thought => thought._id === thoughtId);
    if (!thoughtToDelete) {
      return { success: false, error: 'Thought not found' };
    }

    set((state) => ({ thoughts: createRemoveUpdater(thoughtId)(state.thoughts) }));

    try {
      const response = await authenticatedFetch(`${API_URL}/thoughts/${thoughtId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        return { success: true };
      } else {
        set((state) => ({ thoughts: reinsertThought(state.thoughts, thoughtToDelete) }));
        const errorData = await response.json();
        const errorMessage = extractErrorMessage(errorData, 'Failed to delete thought');
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      set((state) => ({ thoughts: reinsertThought(state.thoughts, thoughtToDelete) }));
      const errorMessage = handleApiError(
        error,
        'Could not delete the thought. Please try again.',
        'Please log in to delete thoughts.'
      );
      return { success: false, error: errorMessage };
    }
  },

  // Add new action for page changes
  changePage: (page) => {
    const { currentPage } = get();
    if (page !== currentPage) {
      get().fetchThoughts(page);
    }
  },

  // Add new action for loading more thoughts (infinite scroll)
  loadMore: () => {
    const { currentPage, loading, hasMore } = get();
    if (!loading && hasMore) {
      get().fetchThoughts(currentPage + 1, true);
    }
  },

  // Add new action for changing view mode
  setViewMode: (mode) => {
    if (mode === 'infinite') {
      // Reset to first page when switching to infinite scroll
      set({ currentPage: 1, thoughts: [] });
      get().fetchThoughts(1);
    }
    set({ viewMode: mode });
  },

  // Add new action for changing thought filter
  setThoughtFilter: (filter) => {
    set({ thoughtFilter: filter, currentPage: 1, thoughts: [] });
    get().fetchThoughts(1);
  }
}));

/**
 * Hook providing the same interface as the original useThoughts hook
 * This maintains compatibility while using Zustand under the hood
 */
export const useThoughts = () => {
  const store = useThoughtsStore();
  
  return {
    thoughts: store.thoughts,
    loading: store.loading,
    error: store.error,
    currentPage: store.currentPage,
    totalPages: store.totalPages,
    totalThoughts: store.totalThoughts,
    hasMore: store.hasMore,
    viewMode: store.viewMode,
    thoughtFilter: store.thoughtFilter,
    addThought: store.addThought,
    handleLike: store.handleLike,
    updateThought: store.updateThought,
    deleteThought: store.deleteThought,
    fetchThoughts: store.fetchThoughts,
    changePage: store.changePage,
    loadMore: store.loadMore,
    setViewMode: store.setViewMode,
    setThoughtFilter: store.setThoughtFilter
  };
}; 