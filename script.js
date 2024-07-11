document.getElementById('calcular').addEventListener('click', function() {
    const tempo = document.getElementById('tempo').value.split(',').map(Number);
    const peso = document.getElementById('peso').value.split(',').map(Number);
    const pesoSeco = parseFloat(document.getElementById('peso_seco').value);
    const area = parseFloat(document.getElementById('area').value);
    const umidadeInicio = parseFloat(document.getElementById('umidade_inicio').value);
    const umidadeFinal = parseFloat(document.getElementById('umidade_final').value);

    const curva = new CurvaSecagem(tempo, peso, pesoSeco, area);
    curva.plotarTaxas();
    const [integralContinua, integralDiscreta] = curva.getTime(umidadeInicio, umidadeFinal);
    displayIntegrals(integralContinua, integralDiscreta);
});

class CurvaSecagem {
    constructor(tempo, peso, pesoSeco, area) {
        this.tempo = tempo;
        this.peso = peso;
        this.pesoSeco = pesoSeco;
        this.area = area;
        
        this.massaAgua = peso.map(p => p - pesoSeco);
        this.teorUmidade = this.massaAgua.map(m => m / pesoSeco);
        this.teorUmidadeEquilibrio = this.teorUmidade[this.teorUmidade.length - 1];
        this.teorUmidadeRelativa = this.teorUmidade.map(t => t - this.teorUmidadeEquilibrio);
        this.teorUmidadeMedia = this.teorUmidadeRelativa.map((t, i, arr) => (arr[i] + (arr[i + 1] || t)) / 2);
        
        this.dxdtDiscreta = this.teorUmidade.map((t, i, arr) => (arr[i + 1] - t) / (this.tempo[i + 1] - this.tempo[i])).slice(0, -1);
        this.dxdtContinua = this.getDerivativePoly2(this.tempo, this.teorUmidade);
        
        this.RaDiscreta = this.dxdtDiscreta.map(d => -pesoSeco * d / area);
        this.RaContinua = this.dxdtContinua.map(d => -pesoSeco * d / area);
    }

    getDerivativePoly2(x, y) {
        const polinomio = this.polyfit(x, y, 2);
        const derivadaPolinomio = this.polider(polinomio);
        return this.polyval(derivadaPolinomio, x);
    }

    plotarTaxas() {
        const trace1 = {
            x: this.teorUmidadeMedia,
            y: this.RaDiscreta,
            mode: 'lines+markers',
            name: 'Taxa de secagem discreta (Ra)',
            line: { dash: 'dash', color: 'red' },
            marker: { color: 'red' }
        };
        
        const trace2 = {
            x: this.teorUmidadeMedia,
            y: this.RaContinua,
            mode: 'lines+markers',
            name: 'Taxa de secagem continua (Ra)',
            line: { dash: 'solid', color: 'blue' },
            marker: { color: 'blue' }
        };
        
        const layout = {
            title: 'Taxa de Secagem vs Teor de Umidade Média',
            xaxis: { title: 'Teor de Umidade Média (Xm)' },
            yaxis: { title: 'Taxa de Secagem (Ra)' }
        };
        
        Plotly.newPlot('plot', [trace1, trace2], layout);
    }

    getTime(teorUmidadeInicio, teorUmidadeFinal) {
        const x = this.teorUmidadeMedia;
        const yContinua = this.RaContinua.map(r => this.pesoSeco / (this.area * r));
        const yDiscreta = this.RaDiscreta.map(r => this.pesoSeco / (this.area * r));
        
        const xNew = linspace(teorUmidadeFinal, teorUmidadeInicio, 1000);
        const yNewContinua = interp1(x, yContinua, xNew);
        const yNewDiscreta = interp1(x, yDiscreta, xNew);
        
        const integralContinua = numeric.trapz(xNew, yNewContinua);
        const integralDiscreta = numeric.trapz(xNew, yNewDiscreta);
        
        return [integralContinua, integralDiscreta];
    }

    polyfit(x, y, degree) {
        const m = x.length;
        const X = [];
        for (let i = 0; i < m; i++) {
            const row = [];
            for (let j = 0; j <= degree; j++) {
                row.push(Math.pow(x[i], degree - j));
            }
            X.push(row);
        }
        const XT = this.transpose(X);
        const XTX = numeric.dot(XT, X);
        const invXTX = numeric.inv(XTX);
        const XTy = numeric.dot(XT, y);
        return numeric.dot(invXTX, XTy);
    }

    polider(poly) {
        const degree = poly.length - 1;
        return poly.slice(0, -1).map((c, i) => c * (degree - i));
    }

    polyval(poly, x) {
        return x.map(xi => poly.reduce((acc, c, i) => acc + c * Math.pow(xi, poly.length - 1 - i), 0));
    }

    transpose(matrix) {
        return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
    }
}

function displayIntegrals(continua, discreta) {
    const output = document.getElementById('output');
    const p = document.createElement('p');
    p.innerHTML = 
        '<strong>Tempo (t) pela taxa continua:</strong> ${continua.toFixed(2)} <br>' 
        '<strong>Tempo (t) pela taxa discreta:</strong> ${discreta.toFixed(2)}'
    ;
    output.innerHTML = '';  // Clear previous output
    output.appendChild(p);
}

function linspace(start, end, num) {
    const step = (end - start) / (num - 1);
    return Array.from({ length: num }, (_, i) => start + i * step);
}

function interp1(x, y, xNew) {
    return xNew.map(xi => {
        let i = 1;
        while (i < x.length && xi > x[i]) i++;
        const x0 = x[i - 1], x1 = x[i];
        const y0 = y[i - 1], y1 = y[i];
        return y0 + (y1 - y0) * (xi - x0) / (x1 - x0);
    });
}
