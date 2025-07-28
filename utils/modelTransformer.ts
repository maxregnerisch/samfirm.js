/**
 * Model transformation utilities for Samsung firmware models
 * Handles deep recoding of model identifiers for API compatibility
 */

// Model transformation mapping
// WARNING: Transforming between different phone generations (S22+ to S23+) 
// will cause firmware compatibility issues and decryption errors
const MODEL_TRANSFORMATIONS: Record<string, string> = {
  // DISABLED: Cross-generation transformation causes firmware incompatibility
  // 's906b': 's916b',  // S22+ to S23+ - NOT COMPATIBLE
  // 'S906B': 'S916B',  // S22+ to S23+ - NOT COMPATIBLE  
  // 'SM-S906B': 'SM-S916B', // S22+ to S23+ - NOT COMPATIBLE
  // 'sm-s906b': 'sm-s916b', // S22+ to S23+ - NOT COMPATIBLE
  
  // Example of valid same-generation transformations:
  // 's906b': 's906u',  // S22+ International to S22+ US (if needed)
  // 'SM-S906B': 'SM-S906U', // S22+ International to S22+ US (if needed)
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
