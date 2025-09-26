import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ColorSelect from '../ColorSelect';
import { vi } from 'vitest';

const noop = () => {};

describe('ColorSelect', () => {
  it('renders Option3 button when onRequestOption3 is provided', () => {
    const onSelect = vi.fn();
    const onRequestOption3 = vi.fn();

    render(
      <ColorSelect
        visible
        onSelect={onSelect}
        timeoutMs={null}
        onTimeout={noop}
        onRequestOption3={onRequestOption3}
      />
    );

    const option3Button = screen.getByRole('button', { name: /추가 백 2수 배치/ });
    fireEvent.click(option3Button);

    expect(onRequestOption3).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not render Option3 button when handler is omitted', () => {
    const onSelect = vi.fn();

    render(
      <ColorSelect
        visible
        onSelect={onSelect}
        timeoutMs={null}
        onTimeout={noop}
      />
    );

    expect(screen.queryByRole('button', { name: /추가 백 2수 배치/ })).not.toBeInTheDocument();
  });
});

