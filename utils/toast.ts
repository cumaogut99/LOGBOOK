import { toast } from 'react-toastify';

/**
 * Shows a success toast notification
 * @param message - Message to display
 * @param details - Optional additional details
 */
export const showSuccess = (message: string, details?: string) => {
  const fullMessage = details ? `${message}\n${details}` : message;
  toast.success(fullMessage, {
    position: 'top-right',
    autoClose: 3000,
  });
};

/**
 * Shows an error toast notification with enhanced error handling
 * @param message - Error message to display
 * @param error - Optional error object for detailed logging
 */
export const showError = (message: string, error?: any) => {
  // Log detailed error to console for debugging
  if (error) {
    console.error('Toast Error:', {
      message,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      timestamp: new Date().toISOString()
    });
  }
  
  // User-friendly error message
  let displayMessage = message;
  
  // Extract useful error information if available
  if (error) {
    if (error.response?.data?.error) {
      displayMessage += `\nDetay: ${error.response.data.error}`;
    } else if (error.message && !message.includes(error.message)) {
      displayMessage += `\nDetay: ${error.message}`;
    }
  }
  
  toast.error(displayMessage, {
    position: 'top-right',
    autoClose: 5000, // Longer for errors
  });
};

/**
 * Shows a warning toast notification
 * @param message - Warning message to display
 */
export const showWarning = (message: string) => {
  toast.warning(message, {
    position: 'top-right',
    autoClose: 3500,
  });
};

/**
 * Shows an info toast notification
 * @param message - Info message to display
 */
export const showInfo = (message: string) => {
  toast.info(message, {
    position: 'top-right',
    autoClose: 3000,
  });
};

/**
 * Shows a loading toast and returns a function to update it
 * @param message - Loading message
 * @returns Function to update the toast with success or error
 */
export const showLoading = (message: string) => {
  const toastId = toast.loading(message, {
    position: 'top-right',
  });
  
  return {
    success: (successMessage: string) => {
      toast.update(toastId, {
        render: successMessage,
        type: 'success',
        isLoading: false,
        autoClose: 3000,
      });
    },
    error: (errorMessage: string) => {
      toast.update(toastId, {
        render: errorMessage,
        type: 'error',
        isLoading: false,
        autoClose: 5000,
      });
    },
    dismiss: () => {
      toast.dismiss(toastId);
    }
  };
};

