# all imports
import os
from flask import Flask, request, session, g, redirect, url_for, abort, render_template, flash, jsonify
import pickle
import json
import numpy as np

app = Flask(__name__)
app.config.from_object(__name__)

# load config
app.config.update(dict(
	USERNAME='glassbox',
	PASSWORD='glassbox'
))

app.config.from_envvar('GLASSBOX_SETTINGS', silent=True)

@app.route('/')
@app.route('/index.html')
def index():
	return render_template('index.html')

@app.route('/data/<dataset>')
def load_data(dataset):
	dataset_file = {
		'ibm-attrition': 'ibm_attrition.p',
		'kmi-university': 'kmi_university_learning.p',
		'mimic3': 'mimic3_30day_readmission.p'
	}.get(dataset, '')

	if not dataset_file:
		raise Exception('dataset not found')

	folder = os.path.abspath(os.path.dirname(__file__))
	with open(os.path.join(folder, 'data', dataset_file), 'rb') as f:
		data = pickle.load(f)
		# print(data.keys())

	# print(data['dataset'].keys())
	outcome_var = data['dataset']['outcome']
	X_test = data['dataset']['X_test']
	Y_test = data['dataset']['Y_test']
	x_scaler = data['dataset']['x_scaler']

	if 'y_scaler' in data['dataset']:
		task = 'regression'
		y_scaler = data['dataset']['y_scaler']

	else:
		task = 'classification'

	bias = data['bias']

	new_data = {
		'main_effects': [],
		'interactions': [],
		'outcome_variable': outcome_var
	}

	if dataset=='mimic3':
		data['interactions'].pop(4)
		data['interactions'].pop(2)
		new_data['outcome_variable'] = 'risk'

		# age
		new_plot = []
		fixed_data_map = {}
		plot = data['main effects'][0]['main effect plot']
		with open(os.path.join(folder, 'data', 'mimic_fixes.json'), 'r') as f:
			drawn_data = json.loads(f.read())
			for d in drawn_data:
				fixed_data_map[d['x']] = d['y']

		for i, d in enumerate(plot):
			if d[0] >= 300:
				d[0] -= 220
				if d[0] in fixed_data_map:
					d[1] = fixed_data_map[d[0]]

				new_plot.append([d[0], d[1]])

			elif not (80 <= d[0] < 300):
				if d[0] in fixed_data_map:
					d[1] = fixed_data_map[d[0]]

				new_plot.append(d)

		data['main effects'][0]['main effect plot'] = np.array(new_plot)


	# print(outcome_var)
	for main_effect in data['main effects'][:10]:
		# print(main_effect.keys())
		if 'main effect plot' not in main_effect:
			main_effect['main effect plot'] = main_effect['main effect']
		plt_len = main_effect['main effect plot'].shape[0]
		if  plt_len > 1000:
			# sampled_indexes = np.random.choice(range(plt_len), 100, replace=False)
			# sampled_indexes = np.array(sorted(list(sampled_indexes)))
			sampled_indexes = np.array(range(0,plt_len,10))
			plot = main_effect['main effect plot'][sampled_indexes,:]
		else:
			plot = main_effect['main effect plot']

		# plot = main_effect['main effect plot']

		new_data['main_effects'].append({
			'name': main_effect['name'],
			'plot': plot.tolist(),
			# 'prediction': [float(p[0]) for p in np.random.choice(main_effect['pred'], 100, replace=False).tolist()],
			'index': main_effect['index']
		})

		# print(main_effect['name'])
		# print(main_effect['main effect'])
		# print(main_effect['pred'])
		# print(main_effect['index'])
		# print('='*80)
		# break

	for interaction in data['interactions'][:5]:
		# print(interaction.keys())
		# if interaction['interaction plot'].shape[0] > 100:
		# 	plot = np.random.choice(interaction['interaction plot'], 100, replace=False)
		# else:

		# plt_len = interaction['interaction plot'].shape[0]
		# if  plt_len > 100:
		# 	# sampled_indexes = np.random.choice(range(plt_len), 100, replace=False)
		# 	# sampled_indexes = np.array(sorted(list(sampled_indexes)))
		# 	sampled_indexes = np.array(range(0,plt_len,100))
		# 	plot = interaction['interaction plot'][sampled_indexes,:]
		# else:
		# 	plot = interaction['interaction plot']
		# print(interaction['matrix'])
		# 100 x 100
		# [y]

		plot = interaction['interaction plot']

		new_data['interactions'].append({
			'names': interaction['names'],
			'plot': plot.tolist(),
			'matrix': interaction['matrix'].tolist(),
			# 'prediction': [float(p[0]) for p in interaction['pred'].tolist()],
			'index': interaction['index']
		})

		# print(interaction['names'])
		# print(interaction['interaction plot'])
		# print(interaction['interaction'])
		# print(interaction['pred'])
		# print(interaction['index'])
		# print('='*80)
		# break

	return jsonify(new_data)

	# return json.dumps(new_data)

