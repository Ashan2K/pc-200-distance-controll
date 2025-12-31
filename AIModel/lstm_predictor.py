from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense


app = Flask(__name__)
CORS(app)

# LSTM settings
TIMESTEPS = 6  # number of previous points the model looks at
FEATURES = 1   # single sensor feature

def build_lstm_model(timesteps=TIMESTEPS, features=FEATURES):
    model = Sequential()
    model.add(LSTM(50, input_shape=(timesteps, features)))
    model.add(Dense(1))
    model.compile(optimizer='adam', loss='mse')
    return model

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        print("Received data for prediction:", data)
        values = data.get('values', [])

        if len(values) < TIMESTEPS:
            # Not enough data to predict
            return jsonify({'error': f'Need at least {TIMESTEPS} values, got {len(values)}'}), 400

        # Convert to numpy array and reshape for LSTM
        values = np.array(values, dtype=float)
        X = values[-TIMESTEPS:].reshape(1, TIMESTEPS, FEATURES)  # take last TIMESTEPS points

        
        y = np.array([values[-1]])  # dummy target, last value
        model = build_lstm_model()
        model.fit(X, y, epochs=10, batch_size=1, verbose=0)

        # Predict next N steps
        N = 6
        preds = []
        input_seq = X.copy()
        for _ in range(N):
            next_val = model.predict(input_seq, verbose=0)[0][0]
            preds.append(round(float(next_val), 2))

            # Slide window
            input_seq = np.roll(input_seq, -1)
            input_seq[0, -1, 0] = next_val

        return jsonify(preds)

    except Exception as e:
        print("Error in /predict:", e)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5005, debug=True)
