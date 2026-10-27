import type { WorkflowStep } from '../types';
import { Icon } from './Icons';

export function StepHeader({ current, onStep }: { current: WorkflowStep; onStep: (step: WorkflowStep) => void }) {
  const steps: Array<{ number: WorkflowStep; label: string }> = [
    { number: 1, label: 'Upload' },
    { number: 2, label: 'Edit & preview' },
    { number: 3, label: 'Download' },
  ];
  return (
    <nav className="steps" aria-label="Creation progress">
      {steps.map((step, index) => (
        <div className="step-wrap" key={step.number}>
          <button
            className={`step ${current === step.number ? 'active' : ''} ${current > step.number ? 'complete' : ''}`}
            onClick={() => onStep(step.number)}
            aria-current={current === step.number ? 'step' : undefined}
          >
            <span>{current > step.number ? <Icon name="check" /> : step.number}</span>
            {step.label}
          </button>
          {index < steps.length - 1 && <i aria-hidden="true" />}
        </div>
      ))}
    </nav>
  );
}
