const suggestions = document.querySelector('.ahead__suggestions')
const input = document.querySelector('.ahead__input');
const icon = document.querySelector('.icon');


icon.addEventListener('click', (e) => {
	if (input.value) {
		search(input.value);
	}
});

suggestions.addEventListener('click', (e) => {
	if (e.target.classList.contains('match')) {
		input.value = e.target.parentNode.innerText;
	} else {
		input.value = e.target.innerText;
	}
	search(input.value);
});

document.onkeyup = function(e) {
	var code = e.charCode || e.keyCode;
	if (code == 13) {
		search(input.value);
	}
}

input.addEventListener('keyup', (e) => {
	//return suggestions.classList.add('hidden');
	const text = event.target.value;
	if (!text) {
		return suggestions.classList.add('hidden')
	} else {
		var inner = document.querySelector('.inner');
		inner.innerHTML = '';
		inner.style.zIndex = 0;
		suggestions.classList.remove('hidden');
			var suggestionItems = `
					<li class="suggestion"><span class="match">${text}</span></li>
				`;	
		var url = corss_api_url+base_url+suggest_url +text;
		// var suggestionItems ='	<li class="suggestion"><span class="match">${text}</span></li>';
		// suggestions.innerHTML = suggestionItems;
		Ajax.get(url,null, function(res) {
			var suggestObj = JSON.parse(res);
			suggestObj[1].forEach(function(suggest){
				if(suggest.toUpperCase() != text.toUpperCase()){
					var ss = `<li class="suggestion">${highLightMatch(`${suggest}`,text)}</li>`;
					suggestionItems = suggestionItems+ss
				}
			});
			suggestions.innerHTML = suggestionItems;
		});
	};
});

function search(keyWord){
	getwikipediaContent(keyWord);
	suggestions.classList.add('hidden')
}

function highLightMatch(sentence, targetText) {
	const regex = new RegExp(targetText, 'gi');
	return sentence.replace(regex, `<span class="match">${targetText}</span>`)
}
