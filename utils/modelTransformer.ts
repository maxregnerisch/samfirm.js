/**
 * Model transformation utilities for Samsung firmware models
 * Handles deep recoding of model identifiers for API compatibility
 */

// Model transformation mapping
const MODEL_TRANSFORMATIONS: Record<string, string> = {
  's906b': 's916b',
  'S906B': 'S916B',
  'SM-S906B': 'SM-S916B', // Handle full Samsung model format
  'sm-s906b': 'sm-s916b', // Handle lowercase full format
};

/**
 * Transforms a model identifier if it exists in the transformation mapping
 * @param originalModel - The original model identifier from user input
 * @returns Object containing both original and transformed model identifiers
 */
export const transformModel = (originalModel: string): {
  original: string;
  transformed: string;
  wasTransformed: boolean;
} => {
  const transformed = MODEL_TRANSFORMATIONS[originalModel] || originalModel;
  const wasTransformed = transformed !== originalModel;

  return {
    original: originalModel,
    transformed,
    wasTransformed,
  };
};

/**
 * Checks if a model requires transformation
 * @param model - The model identifier to check
 * @returns True if the model has a transformation mapping
 */
export const requiresTransformation = (model: string): boolean => {
  return model in MODEL_TRANSFORMATIONS;
};

/**
 * Gets the list of all supported model transformations
 * @returns Array of transformation mappings
 */
export const getSupportedTransformations = (): Array<{ from: string; to: string }> => {
  return Object.entries(MODEL_TRANSFORMATIONS).map(([from, to]) => ({ from, to }));
};
