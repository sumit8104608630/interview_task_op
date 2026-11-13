import React from 'react';
import { Oval, TailSpin } from 'react-loader-spinner';

/**
 * Modern Luxury Hospitality styled spinner.
 * Standardizes async loader aesthetics using Champagne Gold or Deep Charcoal.
 *
 * @param {object} props
 * @param {number} [props.size=24] - Diameter in pixels
 * @param {'champagne'|'charcoal'|'white'} [props.color='champagne'] - Color token
 * @param {'oval'|'tailspin'} [props.variant='oval'] - Spinner shape
 * @param {string} [props.className=''] - Additional container classes
 */
export const Spinner = ({
  size = 24,
  color = 'champagne',
  variant = 'oval',
  className = '',
}) => {
  const colorMap = {
    champagne: '#b08d57',
    charcoal: '#1c1c19',
    white: '#ffffff',
    sand: '#d1c5b6',
  };

  const selectedColor = colorMap[color] || colorMap.champagne;

  return (
    <div className={`inline-flex items-center justify-center ${className}`} role="status" aria-label="Loading">
      {variant === 'tailspin' ? (
        <TailSpin
          height={size}
          width={size}
          color={selectedColor}
          ariaLabel="loading"
          radius="1"
          visible={true}
        />
      ) : (
        <Oval
          height={size}
          width={size}
          color={selectedColor}
          secondaryColor="rgba(176, 141, 87, 0.2)"
          strokeWidth={3}
          strokeWidthSecondary={3}
          ariaLabel="loading"
          visible={true}
        />
      )}
    </div>
  );
};

export default Spinner;
