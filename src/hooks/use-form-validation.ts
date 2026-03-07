"use client";

import { useState, useCallback, useRef } from "react";

type ChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

interface UseFormValidationOptions<T extends Record<string, string>> {
  fields: { [K in keyof T]: (value: string) => string | null };
  onSubmit: (values: T) => void | Promise<void>;
  initialValues?: Partial<T>;
}

interface UseFormValidationReturn<T extends Record<string, string>> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  handleChange: (field: keyof T) => (e: ChangeEvent) => void;
  handleBlur: (field: keyof T) => () => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  isValid: boolean;
  isSubmitting: boolean;
  setFieldValue: (field: keyof T, value: string) => void;
  setFieldError: (field: keyof T, error: string | null) => void;
  reset: () => void;
  validateAll: () => boolean;
  formErrors: string[];
  scrollToFirstError: () => void;
}

export function useFormValidation<T extends Record<string, string>>(
  options: UseFormValidationOptions<T>
): UseFormValidationReturn<T> {
  const { fields, onSubmit, initialValues = {} } = options;
  
  // Initialize values with empty strings for all fields
  const getInitialValues = (): T => {
    const values: Record<string, string> = {};
    for (const key of Object.keys(fields)) {
      values[key] = (initialValues as Record<string, string>)[key] || "";
    }
    return values as T;
  };

  const [values, setValues] = useState<T>(getInitialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fieldRefs = useRef<Map<keyof T, HTMLElement>>(new Map());

  const validateField = useCallback((field: keyof T, value: string): string | null => {
    const validator = fields[field];
    return validator ? validator(value) : null;
  }, [fields]);

  const handleChange = useCallback((field: keyof T) => {
    return (e: ChangeEvent) => {
      const value = e.target.value;
      setValues(prev => ({ ...prev, [field]: value }));
      
      // Clear error when user starts typing (if field was touched)
      if (touched[field]) {
        const error = validateField(field, value);
        setErrors(prev => ({ ...prev, [field]: error || undefined }));
      }
      
      // Store ref for scroll functionality
      fieldRefs.current.set(field, e.target);
    };
  }, [touched, validateField]);

  const handleBlur = useCallback((field: keyof T) => {
    return () => {
      setTouched(prev => ({ ...prev, [field]: true }));
      
      const error = validateField(field, values[field]);
      setErrors(prev => ({ ...prev, [field]: error || undefined }));
    };
  }, [values, validateField]);

  const validateAll = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    for (const field of Object.keys(fields) as (keyof T)[]) {
      const error = validateField(field, values[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    }

    setErrors(newErrors);
    // Mark all fields as touched
    const allTouched: Partial<Record<keyof T, boolean>> = {};
    for (const field of Object.keys(fields) as (keyof T)[]) {
      allTouched[field] = true;
    }
    setTouched(allTouched);

    return isValid;
  }, [fields, values, validateField]);

  const scrollToFirstError = useCallback(() => {
    const errorFields = Object.keys(errors) as (keyof T)[];
    if (errorFields.length > 0) {
      const firstErrorField = errorFields[0];
      const element = fieldRefs.current.get(firstErrorField);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.focus();
      }
    }
  }, [errors]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isValid = validateAll();
    
    if (!isValid) {
      scrollToFirstError();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validateAll, onSubmit, scrollToFirstError]);

  const setFieldValue = useCallback((field: keyof T, value: string) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const setFieldError = useCallback((field: keyof T, error: string | null) => {
    setErrors(prev => ({ ...prev, [field]: error || undefined }));
  }, []);

  const reset = useCallback(() => {
    setValues(getInitialValues());
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute isValid
  const isValid = Object.keys(fields).every((field) => {
    const error = validateField(field as keyof T, values[field as keyof T]);
    return !error;
  });

  // Get array of current error messages for form-level summary
  const formErrors = Object.values(errors).filter(Boolean) as string[];

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    isValid,
    isSubmitting,
    setFieldValue,
    setFieldError,
    reset,
    validateAll,
    formErrors,
    scrollToFirstError,
  };
}
