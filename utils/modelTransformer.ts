/**
 * Model transformation utilities for Samsung firmware models
 * Handles deep recoding of model identifiers for API compatibility
 */

// Model transformation mapping for firmware development and porting
// WARNING: This transformation is for DEVELOPMENT/PORTING purposes only!
// DO NOT flash cross-generation firmware to actual devices - it will brick them!
const MODEL_TRANSFORMATIONS: Record<string, string> = {
  // Development transformations for firmware analysis and porting
  's906b': 's916b',     // S22+ to S23+ for firmware analysis/porting
  'S906B': 'S916B',     // S22+ to S23+ for firmware analysis/porting
  'SM-S906B': 'SM-S916B', // S22+ to S23+ for firmware analysis/porting
  'sm-s906b': 'sm-s916b', // S22+ to S23+ for firmware analysis/porting
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

  if (wasTransformed) {
    console.log(`🔄 Model transformation applied: ${originalModel} → ${transformed}`);
    console.log(`⚠️  DEVELOPMENT MODE: This firmware is for analysis/porting only!`);
    console.log(`⚠️  DO NOT flash cross-generation firmware to actual devices!`);
  }

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
