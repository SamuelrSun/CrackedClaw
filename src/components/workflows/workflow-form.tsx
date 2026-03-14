"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconPicker } from "./icon-picker";
import { cn } from "@/lib/utils";

export type TriggerType = "manual" | "scheduled" | "webhook";
export type ScheduleFrequency = "daily" | "weekly" | "monthly" | "custom";

export interface WorkflowFormData {
  name: string;
  description: string;
  icon: string;
  triggerType: TriggerType;
  schedule?: {
    frequency: ScheduleFrequency;
    cronExpression?: string;
    time?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
}

interface WorkflowFormProps {
  initialData?: Partial<WorkflowFormData>;
  onSubmit: (data: WorkflowFormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  isLoading?: boolean;
}

const TRIGGER_TYPES: { value: TriggerType; label: string; description: string }[] = [
  { value: "manual", label: "Manual", description: "Run on demand" },
  { value: "scheduled", label: "Scheduled", description: "Run on a schedule" },
  { value: "webhook", label: "Webhook", description: "Trigger via HTTP request" },
];

const SCHEDULE_FREQUENCIES: { value: ScheduleFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom (Cron)" },
];

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function WorkflowForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = "Save Workflow",
  isLoading = false,
}: WorkflowFormProps) {
  const [formData, setFormData] = useState<WorkflowFormData>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    icon: initialData?.icon || "Zap",
    triggerType: initialData?.triggerType || "manual",
    schedule: initialData?.schedule || {
      frequency: "daily",
      time: "09:00",
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    if (
      formData.triggerType === "scheduled" &&
      formData.schedule?.frequency === "custom" &&
      !formData.schedule?.cronExpression?.trim()
    ) {
      newErrors.cronExpression = "Cron expression is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  const updateSchedule = (updates: Partial<WorkflowFormData["schedule"]>) => {
    setFormData((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule!,
        ...updates,
      },
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <Input
          label="Name *"
          placeholder="My Workflow"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={errors.name ? "border-coral" : ""}
        />
        {errors.name && (
          <p className="text-coral text-xs mt-1">{errors.name}</p>
        )}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
          Description *
        </label>
        <textarea
          placeholder="Describe what this workflow does..."
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          rows={3}
          className={cn(
            "w-full bg-white border border-white/[0.1] rounded-none px-3 py-2",
            "font-body text-sm text-forest placeholder:text-grid/30",
            "outline-none focus:border-forest transition-colors resize-none",
            errors.description && "border-coral"
          )}
        />
        {errors.description && (
          <p className="text-coral text-xs mt-1">{errors.description}</p>
        )}
      </div>

      {/* Icon Picker */}
      <IconPicker
        value={formData.icon}
        onChange={(icon) => setFormData({ ...formData, icon })}
      />

      {/* Trigger Type */}
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
          Trigger Type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {TRIGGER_TYPES.map(({ value, label, description }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFormData({ ...formData, triggerType: value })}
              className={cn(
                "p-3 border border-white/[0.1] text-left transition-all",
                "hover:border-forest hover:bg-forest/5",
                formData.triggerType === value &&
                  "border-forest bg-forest/10"
              )}
            >
              <span className="font-mono text-[10px] uppercase tracking-wide block">
                {label}
              </span>
              <span className="text-xs text-grid/60 mt-1 block">
                {description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Options (shown when triggerType is 'scheduled') */}
      {formData.triggerType === "scheduled" && (
        <div className="border border-white/[0.1] p-4 space-y-4 bg-white">
          <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60 block">
            Schedule Configuration
          </label>

          {/* Frequency */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
              Frequency
            </label>
            <select
              value={formData.schedule?.frequency || "daily"}
              onChange={(e) =>
                updateSchedule({
                  frequency: e.target.value as ScheduleFrequency,
                })
              }
              className="w-full bg-white border border-white/[0.1] rounded-none px-3 py-2 font-body text-sm text-forest outline-none focus:border-forest"
            >
              {SCHEDULE_FREQUENCIES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Time (for daily/weekly/monthly) */}
          {formData.schedule?.frequency !== "custom" && (
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
                Time
              </label>
              <input
                type="time"
                value={formData.schedule?.time || "09:00"}
                onChange={(e) => updateSchedule({ time: e.target.value })}
                className="w-full bg-white border border-white/[0.1] rounded-none px-3 py-2 font-body text-sm text-forest outline-none focus:border-forest"
              />
            </div>
          )}

          {/* Day of Week (for weekly) */}
          {formData.schedule?.frequency === "weekly" && (
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
                Day of Week
              </label>
              <select
                value={formData.schedule?.dayOfWeek ?? 1}
                onChange={(e) =>
                  updateSchedule({ dayOfWeek: parseInt(e.target.value) })
                }
                className="w-full bg-white border border-white/[0.1] rounded-none px-3 py-2 font-body text-sm text-forest outline-none focus:border-forest"
              >
                {DAYS_OF_WEEK.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Day of Month (for monthly) */}
          {formData.schedule?.frequency === "monthly" && (
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
                Day of Month
              </label>
              <select
                value={formData.schedule?.dayOfMonth ?? 1}
                onChange={(e) =>
                  updateSchedule({ dayOfMonth: parseInt(e.target.value) })
                }
                className="w-full bg-white border border-white/[0.1] rounded-none px-3 py-2 font-body text-sm text-forest outline-none focus:border-forest"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cron Expression (for custom) */}
          {formData.schedule?.frequency === "custom" && (
            <div>
              <Input
                label="Cron Expression"
                placeholder="0 9 * * *"
                value={formData.schedule?.cronExpression || ""}
                onChange={(e) =>
                  updateSchedule({ cronExpression: e.target.value })
                }
                className={errors.cronExpression ? "border-coral" : ""}
              />
              {errors.cronExpression && (
                <p className="text-coral text-xs mt-1">
                  {errors.cronExpression}
                </p>
              )}
              <p className="text-xs text-grid/50 mt-1">
                Format: minute hour day-of-month month day-of-week
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="solid" disabled={isLoading}>
          {isLoading ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
