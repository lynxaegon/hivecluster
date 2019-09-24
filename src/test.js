console.log(
	sharedStart(["5d84a2a25dd52e8e43a8c5c9","5d84a2a25dd52e8e43a8c5ca"])
);

function sharedStart(strings){
	strings = strings.sort();
	let s1 = strings[0];
	let s2 = strings[strings.length - 1];
	let len = s1.length;
	let i = 0;
	while(i < len && s1.charAt(i) === s2.charAt(i)){
		i++;
	}
	return s1.substr(0, i);
}