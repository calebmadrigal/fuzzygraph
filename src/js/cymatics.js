export function uniformly_distributed_points(numPoints, distance, rotateRadians = 0) {
    numPoints = Number(numPoints);
    distance = Number(distance);
    rotateRadians = Number(rotateRadians);

    if (numPoints === 1) {
        return [{ x: 0, y: 0 }];
    }

    const points = [];
    for (let i = 0; i < numPoints; i++) {
        const angle = (2 * Math.PI * i) / numPoints + rotateRadians;
        let x = distance * Math.cos(angle);
        let y = distance * Math.sin(angle);

        if (Math.abs(x) < 1e-6) x = 0;
        if (Math.abs(y) < 1e-6) y = 0;

        points.push({ x, y });
    }
    return points;
}

export function sinc(point, amplitude, frequency, phase = 0) {
    const { x, y } = point;
    return (
        `${amplitude} * sin( ${frequency} * 2 * pi * ` +
        `((x-(${x}))^2 + (y-(${y}))^2)^(1/2) + ${phase})` +
        `/ (${frequency} * 2 * pi *  ((x-(${x}))^2 + (y-(${y}))^2)^(1/2) + 1e-6)`
    );
}

export function cymatics_equation_generator(
    numPoints,
    distance,
    amplitude,
    frequency,
    phase = 0,
    combineOperator = '+',
    rotateRadians = 0
) {
    const resonatorPoints = uniformly_distributed_points(
        numPoints,
        distance,
        rotateRadians
    );

    const resonators = resonatorPoints.map((pt) =>
        sinc(pt, amplitude, frequency, phase)
    );

    let eqStr = resonators.join(` ${combineOperator} `);
    eqStr += ' = 0';
    return eqStr;
}

